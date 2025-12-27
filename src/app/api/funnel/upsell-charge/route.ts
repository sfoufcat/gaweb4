import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import { enrollUserInProduct } from '@/lib/enrollments';
import type { 
  FlowSession, 
  OrgSettings, 
  FunnelStep, 
  FunnelStepConfigUpsell,
  FunnelStepConfigDownsell,
} from '@/types';

// Lazy initialization to avoid build-time errors
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return _stripe;
}

/**
 * POST /api/funnel/upsell-charge
 * One-click charge for upsell/downsell using the stored payment method from initial purchase
 * 
 * Body:
 * - flowSessionId: string (required) - The flow session from initial purchase
 * - stepId: string (required) - The upsell/downsell step ID
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { flowSessionId, stepId } = body;

    if (!flowSessionId || !stepId) {
      return NextResponse.json(
        { error: 'Missing required fields: flowSessionId and stepId' },
        { status: 400 }
      );
    }

    // Get flow session
    const sessionDoc = await adminDb.collection('flow_sessions').doc(flowSessionId).get();
    if (!sessionDoc.exists) {
      return NextResponse.json(
        { error: 'Flow session not found' },
        { status: 404 }
      );
    }

    const session = sessionDoc.data() as FlowSession;
    
    // Verify session belongs to this user
    if (session.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized - session does not belong to this user' },
        { status: 403 }
      );
    }

    // Get payment method from session data
    const sessionData = session.data || {};
    const paymentMethodId = sessionData.stripePaymentMethodId as string | undefined;
    const stripeConnectAccountId = sessionData.stripeConnectAccountId as string | undefined;
    
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'No payment method found. User must complete initial purchase first.' },
        { status: 400 }
      );
    }

    // Get the upsell/downsell step configuration
    const stepDoc = await adminDb
      .collection('funnels')
      .doc(session.funnelId)
      .collection('steps')
      .doc(stepId)
      .get();

    if (!stepDoc.exists) {
      return NextResponse.json(
        { error: 'Step not found' },
        { status: 404 }
      );
    }

    const step = { id: stepDoc.id, ...stepDoc.data() } as FunnelStep;
    
    if (step.type !== 'upsell' && step.type !== 'downsell') {
      return NextResponse.json(
        { error: 'Invalid step type - must be upsell or downsell' },
        { status: 400 }
      );
    }

    const stepConfig = (step.config as { type: 'upsell' | 'downsell'; config: FunnelStepConfigUpsell | FunnelStepConfigDownsell }).config;

    // Get organization settings for Stripe Connect
    const orgSettingsDoc = await adminDb.collection('org_settings').doc(session.organizationId).get();
    const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

    const connectedAccountId = stripeConnectAccountId || orgSettings?.stripeConnectAccountId;
    if (!connectedAccountId) {
      return NextResponse.json(
        { error: 'Payment processing is not configured' },
        { status: 400 }
      );
    }

    // Get customer ID for this connected account
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data() as { stripeConnectedCustomerIds?: Record<string, string> } | undefined;
    const connectedCustomerIds: Record<string, string> = userData?.stripeConnectedCustomerIds || {};
    const customerId = connectedCustomerIds[connectedAccountId];

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer not found - user must complete initial purchase first' },
        { status: 400 }
      );
    }

    // Calculate platform fee
    const platformFeePercent = orgSettings?.platformFeePercent ?? 1;
    const priceInCents = stepConfig.finalPriceInCents;
    const applicationFeeAmount = Math.round(priceInCents * (platformFeePercent / 100));

    // Build metadata
    const metadata: Record<string, string> = {
      userId,
      type: step.type === 'upsell' ? 'funnel_upsell' : 'funnel_downsell',
      flowSessionId,
      funnelId: session.funnelId,
      stepId,
      organizationId: session.organizationId,
      productType: stepConfig.productType,
      productId: stepConfig.productId,
    };

    // Create one-click payment intent and confirm immediately
    const stripe = getStripe();
    
    let paymentIntent: Stripe.PaymentIntent;
    
    try {
      if (stepConfig.isRecurring && stepConfig.stripePriceId) {
        // For recurring, create a subscription instead
        const subscriptionParams: Stripe.SubscriptionCreateParams = {
          customer: customerId,
          items: [{ price: stepConfig.stripePriceId }],
          default_payment_method: paymentMethodId,
          application_fee_percent: platformFeePercent,
          metadata,
        };
        
        // Apply coupon if discounted
        if (stepConfig.stripeCouponId) {
          subscriptionParams.coupon = stepConfig.stripeCouponId;
        }
        
        const subscription = await stripe.subscriptions.create(
          subscriptionParams,
          { stripeAccount: connectedAccountId }
        );

        // Get the latest invoice's payment intent
        const invoiceId = subscription.latest_invoice;
        if (typeof invoiceId !== 'string') {
          throw new Error('Subscription created but no invoice ID found');
        }
        
        const invoice = await stripe.invoices.retrieve(
          invoiceId,
          { stripeAccount: connectedAccountId }
        );

        const paymentIntentId = invoice.payment_intent;
        if (!paymentIntentId || typeof paymentIntentId !== 'string') {
          throw new Error('Subscription created but no payment intent found');
        }

        paymentIntent = await stripe.paymentIntents.retrieve(
          paymentIntentId,
          { stripeAccount: connectedAccountId }
        );
      } else {
        // One-time payment - create and confirm payment intent immediately
        paymentIntent = await stripe.paymentIntents.create(
          {
            amount: priceInCents,
            currency: 'usd',
            customer: customerId,
            payment_method: paymentMethodId,
            confirm: true, // Confirm immediately for one-click
            off_session: true, // Customer not present
            description: `${step.type === 'upsell' ? 'Upsell' : 'Downsell'}: ${stepConfig.productName}`,
            metadata,
            application_fee_amount: applicationFeeAmount,
          },
          { stripeAccount: connectedAccountId }
        );
      }
    } catch (stripeError) {
      console.error('[UPSELL_CHARGE] Stripe error:', stripeError);
      
      if (stripeError instanceof Stripe.errors.StripeCardError) {
        return NextResponse.json(
          { error: 'Payment failed: ' + stripeError.message },
          { status: 400 }
        );
      }
      
      throw stripeError;
    }

    // Check if payment succeeded
    if (paymentIntent.status !== 'succeeded') {
      console.error('[UPSELL_CHARGE] Payment not succeeded:', paymentIntent.status);
      return NextResponse.json(
        { 
          error: 'Payment not completed', 
          status: paymentIntent.status,
          requiresAction: paymentIntent.status === 'requires_action',
        },
        { status: 400 }
      );
    }

    // Payment succeeded - enroll user in the product
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    
    const enrollmentResult = await enrollUserInProduct(
      userId,
      stepConfig.productType,
      stepConfig.productId,
      {
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
        email: clerkUser.emailAddresses[0]?.emailAddress,
      },
      {
        stripePaymentIntentId: paymentIntent.id,
        amountPaid: priceInCents,
      }
    );

    if (!enrollmentResult.success) {
      console.error('[UPSELL_CHARGE] Enrollment failed:', enrollmentResult.error);
      // Payment succeeded but enrollment failed - log for manual review
      // We don't refund automatically to avoid complexity
      return NextResponse.json(
        { 
          error: 'Payment succeeded but enrollment failed. Please contact support.',
          paymentIntentId: paymentIntent.id,
        },
        { status: 500 }
      );
    }

    // Update flow session with upsell/downsell purchase info
    interface UpsellPurchase {
      stepId: string;
      productId: string;
      productType: string;
      amountPaid: number;
      paymentIntentId: string;
      enrollmentId?: string;
      purchasedAt: string;
    }
    
    const existingData = session.data || {};
    const purchasedUpsells: UpsellPurchase[] = (existingData.purchasedUpsells as UpsellPurchase[] | undefined) || [];
    const purchasedDownsells: UpsellPurchase[] = (existingData.purchasedDownsells as UpsellPurchase[] | undefined) || [];
    
    const purchaseRecord: UpsellPurchase = {
      stepId,
      productId: stepConfig.productId,
      productType: stepConfig.productType,
      amountPaid: priceInCents,
      paymentIntentId: paymentIntent.id,
      enrollmentId: enrollmentResult.enrollmentId,
      purchasedAt: new Date().toISOString(),
    };
    
    if (step.type === 'upsell') {
      purchasedUpsells.push(purchaseRecord);
    } else {
      purchasedDownsells.push(purchaseRecord);
    }

    await sessionDoc.ref.update({
      data: {
        ...existingData,
        purchasedUpsells,
        purchasedDownsells,
      },
      updatedAt: new Date().toISOString(),
    });

    console.log(`[UPSELL_CHARGE] Successfully charged ${priceInCents} cents for ${step.type} and enrolled user ${userId} in ${stepConfig.productType} ${stepConfig.productId}`);

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      enrollmentId: enrollmentResult.enrollmentId,
      productType: stepConfig.productType,
      productId: stepConfig.productId,
    });

  } catch (error) {
    console.error('[UPSELL_CHARGE_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to process upsell payment' },
      { status: 500 }
    );
  }
}

