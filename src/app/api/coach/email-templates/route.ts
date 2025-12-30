import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { sanitizeHtmlTemplate, DEFAULT_EMAIL_TEMPLATES } from '@/lib/email-templates';
import type { OrgBranding, OrgEmailTemplates, EmailTemplateType, EmailTemplate } from '@/types';

const VALID_TEMPLATE_TYPES: EmailTemplateType[] = [
  'welcome',
  'abandonedCart',
  'morningReminder',
  'eveningReminder',
  'weeklyReminder',
  'paymentFailed',
];

/**
 * GET /api/coach/email-templates
 * Get email templates for the coach's organization
 * Only available when email domain is verified
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    // Get branding to check email settings and templates
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
    
    if (!brandingDoc.exists) {
      return NextResponse.json({ 
        emailTemplates: null,
        isVerified: false,
        message: 'No branding configured',
      });
    }

    const branding = brandingDoc.data() as OrgBranding;
    
    // Check if email domain is verified
    const isVerified = branding.emailSettings?.status === 'verified';
    
    if (!isVerified) {
      return NextResponse.json({
        emailTemplates: null,
        isVerified: false,
        message: 'Email domain not verified',
      });
    }

    return NextResponse.json({
      emailTemplates: branding.emailTemplates || null,
      isVerified: true,
    });
  } catch (error) {
    console.error('[EMAIL_TEMPLATES_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch email templates';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/coach/email-templates
 * Save a custom email template
 * Only available when email domain is verified
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    const { templateType, subject, html } = body;

    // Validate template type
    if (!templateType || !VALID_TEMPLATE_TYPES.includes(templateType)) {
      return NextResponse.json(
        { error: `Invalid template type. Must be one of: ${VALID_TEMPLATE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return NextResponse.json(
        { error: 'Subject is required' },
        { status: 400 }
      );
    }

    if (!html || typeof html !== 'string' || html.trim().length === 0) {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      );
    }

    // Get branding to check email settings
    const brandingRef = adminDb.collection('org_branding').doc(organizationId);
    const brandingDoc = await brandingRef.get();
    
    if (!brandingDoc.exists) {
      return NextResponse.json(
        { error: 'Organization branding not configured' },
        { status: 400 }
      );
    }

    const branding = brandingDoc.data() as OrgBranding;
    
    // Check if email domain is verified
    if (branding.emailSettings?.status !== 'verified') {
      return NextResponse.json(
        { error: 'Email template customization requires a verified email domain' },
        { status: 403 }
      );
    }

    // Sanitize HTML
    const sanitizedHtml = sanitizeHtmlTemplate(html);

    // Create template object
    const template: EmailTemplate = {
      subject: subject.trim(),
      html: sanitizedHtml,
      updatedAt: new Date().toISOString(),
    };

    // Update templates
    const existingTemplates = branding.emailTemplates || {};
    const updatedTemplates: OrgEmailTemplates = {
      ...existingTemplates,
      [templateType]: template,
    };

    // Save to Firestore
    await brandingRef.update({
      emailTemplates: updatedTemplates,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[EMAIL_TEMPLATES_POST] Saved ${templateType} template for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      template,
      templateType,
    });
  } catch (error) {
    console.error('[EMAIL_TEMPLATES_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save email template';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/email-templates
 * Reset a template to default
 */
export async function DELETE(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { searchParams } = new URL(request.url);
    const templateType = searchParams.get('templateType') as EmailTemplateType | null;

    // Validate template type
    if (!templateType || !VALID_TEMPLATE_TYPES.includes(templateType)) {
      return NextResponse.json(
        { error: `Invalid template type. Must be one of: ${VALID_TEMPLATE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Get branding
    const brandingRef = adminDb.collection('org_branding').doc(organizationId);
    const brandingDoc = await brandingRef.get();
    
    if (!brandingDoc.exists) {
      return NextResponse.json(
        { error: 'Organization branding not configured' },
        { status: 400 }
      );
    }

    const branding = brandingDoc.data() as OrgBranding;
    
    // Check if email domain is verified
    if (branding.emailSettings?.status !== 'verified') {
      return NextResponse.json(
        { error: 'Email template customization requires a verified email domain' },
        { status: 403 }
      );
    }

    // Remove template (revert to default)
    const existingTemplates = branding.emailTemplates || {};
    const { [templateType]: removed, ...remainingTemplates } = existingTemplates;

    // Save to Firestore
    await brandingRef.update({
      emailTemplates: remainingTemplates,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[EMAIL_TEMPLATES_DELETE] Reset ${templateType} template to default for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      templateType,
      defaultTemplate: DEFAULT_EMAIL_TEMPLATES[templateType],
    });
  } catch (error) {
    console.error('[EMAIL_TEMPLATES_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to reset email template';
    
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

