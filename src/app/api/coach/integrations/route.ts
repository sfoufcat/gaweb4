/**
 * Coach Integrations API
 * 
 * GET /api/coach/integrations - List all integrations for the organization
 * POST /api/coach/integrations - Connect a new integration (webhook/API key types)
 * DELETE /api/coach/integrations - Disconnect an integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import {
  listIntegrations,
  storeWebhookIntegration,
  storeApiKeyIntegration,
  disconnectIntegration,
  INTEGRATION_PROVIDERS,
  getConfiguredIntegrations,
  type IntegrationProvider,
  type WebhookSettings,
  type TranscriptionSettings,
  type SlackSettings,
  type DiscordSettings,
  type CalcomSettings,
} from '@/lib/integrations';

/**
 * GET /api/coach/integrations
 * 
 * List all integrations for the coach's organization
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const integrations = await listIntegrations(organizationId);

    // Get available integrations (not yet connected)
    const connectedProviders = new Set(integrations.map((i) => i.provider));
    const available = Object.values(INTEGRATION_PROVIDERS).filter(
      (provider) => !connectedProviders.has(provider.id)
    );

    // Get which providers are configured (have OAuth credentials)
    const configured = getConfiguredIntegrations();

    return NextResponse.json({
      integrations,
      available,
      configured,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_INTEGRATIONS_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('TenantRequired')) {
      return NextResponse.json(
        { error: 'Please access this feature from your organization domain' },
        { status: 403 }
      );
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/integrations
 * 
 * Connect a new integration.
 * For OAuth integrations, this initiates the OAuth flow.
 * For webhook/API key integrations, this stores the credentials directly.
 * 
 * Body:
 * - provider: IntegrationProvider (required)
 * - webhookUrl?: string (for zapier/make)
 * - apiKey?: string (for deepgram/assemblyai)
 * - settings?: object (provider-specific settings)
 */
export async function POST(req: NextRequest) {
  try {
    const { organizationId, userId } = await requireCoachWithOrg();

    const body = await req.json();
    const { provider, webhookUrl, apiKey, settings } = body as {
      provider: IntegrationProvider;
      webhookUrl?: string;
      apiKey?: string;
      settings?: Record<string, unknown>;
    };

    // Validate provider
    if (!provider || !INTEGRATION_PROVIDERS[provider]) {
      return NextResponse.json(
        { error: 'Invalid provider' },
        { status: 400 }
      );
    }

    const providerMeta = INTEGRATION_PROVIDERS[provider];

    // Handle different auth types
    if (providerMeta.authType === 'oauth2') {
      // For OAuth providers, return the auth URL
      // The actual OAuth flow is handled by separate callback routes
      const state = Buffer.from(
        JSON.stringify({ orgId: organizationId, userId, provider })
      ).toString('base64');

      let authUrl: string;

      switch (provider) {
        case 'google_calendar':
          authUrl = getGoogleOAuthUrl(state, providerMeta.scopes || [], 'google_calendar');
          break;
        case 'google_sheets':
          authUrl = getGoogleOAuthUrl(state, providerMeta.scopes || [], 'google_sheets');
          break;
        case 'outlook_calendar':
          authUrl = getMicrosoftOAuthUrl(state, providerMeta.scopes || []);
          break;
        case 'notion':
          authUrl = getNotionOAuthUrl(state);
          break;
        case 'airtable':
          authUrl = getAirtableOAuthUrl(state, providerMeta.scopes || []);
          break;
        case 'todoist':
          authUrl = getTodoistOAuthUrl(state, providerMeta.scopes || []);
          break;
        case 'asana':
          authUrl = getAsanaOAuthUrl(state);
          break;
        case 'slack':
          authUrl = getSlackOAuthUrl(state, providerMeta.scopes || []);
          break;
        case 'zoom':
          authUrl = getZoomOAuthUrl(state);
          break;
        // Note: google_meet is now part of google_calendar (enableMeetLinks toggle)
        default:
          return NextResponse.json(
            { error: 'OAuth not supported for this provider' },
            { status: 400 }
          );
      }

      return NextResponse.json({
        type: 'oauth',
        authUrl,
        state,
      });
    }

    if (providerMeta.authType === 'webhook') {
      // Webhook-based integrations (Zapier/Make/Discord)
      if (!webhookUrl) {
        return NextResponse.json(
          { error: 'webhookUrl is required for webhook integrations' },
          { status: 400 }
        );
      }

      // Validate URL format
      try {
        new URL(webhookUrl);
      } catch {
        return NextResponse.json(
          { error: 'Invalid webhook URL format' },
          { status: 400 }
        );
      }

      // Handle Discord webhook specifically
      if (provider === 'discord') {
        const discordSettings: DiscordSettings = {
          provider: 'discord',
          notifyCheckins: settings?.notifyCheckins !== false,
          notifyGoals: settings?.notifyGoals !== false,
          notifyPayments: settings?.notifyPayments !== false,
          notifyNewClients: settings?.notifyNewClients !== false,
        };

        const integration = await storeWebhookIntegration(
          organizationId,
          'discord' as 'zapier' | 'make', // Type workaround - will work with existing function
          webhookUrl,
          discordSettings as unknown as WebhookSettings,
          userId
        );

        return NextResponse.json({
          success: true,
          integration,
        });
      }

      const webhookSettings: WebhookSettings = {
        provider: provider as 'zapier' | 'make',
        events: settings?.events as WebhookSettings['events'] || [],
        includeClientData: settings?.includeClientData === true,
        retryOnFailure: settings?.retryOnFailure !== false,
        maxRetries: settings?.maxRetries as number || 3,
      };

      const integration = await storeWebhookIntegration(
        organizationId,
        provider as 'zapier' | 'make',
        webhookUrl,
        webhookSettings,
        userId
      );

      return NextResponse.json({
        success: true,
        integration,
      });
    }

    if (providerMeta.authType === 'api_key') {
      // API key integrations (Deepgram/AssemblyAI/Cal.com)
      if (!apiKey) {
        return NextResponse.json(
          { error: 'apiKey is required for API key integrations' },
          { status: 400 }
        );
      }

      // Handle Cal.com specifically
      if (provider === 'calcom') {
        const calcomSettings: CalcomSettings = {
          provider: 'calcom',
          username: settings?.username as string,
          eventTypeSlug: settings?.eventTypeSlug as string,
          embedEnabled: settings?.embedEnabled === true,
          autoCreateLinks: settings?.autoCreateLinks !== false,
        };

        const integration = await storeApiKeyIntegration(
          organizationId,
          'calcom' as 'deepgram' | 'assemblyai', // Type workaround
          apiKey,
          calcomSettings as unknown as TranscriptionSettings,
          userId
        );

        return NextResponse.json({
          success: true,
          integration,
        });
      }

      const transcriptionSettings: TranscriptionSettings = {
        provider: provider as 'deepgram' | 'assemblyai',
        language: settings?.language as string || 'en',
        speakerDiarization: settings?.speakerDiarization === true,
        punctuation: settings?.punctuation !== false,
        autoTranscribe: settings?.autoTranscribe === true,
        summarize: settings?.summarize === true,
      };

      const integration = await storeApiKeyIntegration(
        organizationId,
        provider as 'deepgram' | 'assemblyai',
        apiKey,
        transcriptionSettings,
        userId
      );

      return NextResponse.json({
        success: true,
        integration,
      });
    }

    return NextResponse.json(
      { error: 'Unsupported auth type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[COACH_INTEGRATIONS_POST_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('INTEGRATION_ENCRYPTION_KEY')) {
      return NextResponse.json(
        { error: 'Server configuration error: encryption key not set' },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/integrations
 * 
 * Disconnect an integration
 * 
 * Body:
 * - integrationId: string (required)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { integrationId } = body as { integrationId: string };

    if (!integrationId) {
      return NextResponse.json(
        { error: 'integrationId is required' },
        { status: 400 }
      );
    }

    await disconnectIntegration(organizationId, integrationId);

    return NextResponse.json({
      success: true,
      message: 'Integration disconnected',
    });
  } catch (error) {
    console.error('[COACH_INTEGRATIONS_DELETE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

// =============================================================================
// OAuth URL Generators
// =============================================================================

function getGoogleOAuthUrl(state: string, scopes: string[], provider: 'google_calendar' | 'google_sheets'): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const callbackPath = provider;
  // Use calendar subdomain for OAuth callbacks to avoid auth issues on subdomains
  const baseUrl = process.env.GOOGLE_OAUTH_REDIRECT_BASE_URL || 'https://calendar.coachful.co';
  const redirectUri = `${baseUrl}/api/coach/integrations/${callbackPath}/callback`;

  if (!clientId) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function getMicrosoftOAuthUrl(state: string, scopes: string[]): string {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/coach/integrations/outlook_calendar/callback`;

  if (!clientId) {
    throw new Error('MICROSOFT_OAUTH_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [...scopes, 'openid', 'profile', 'email'].join(' '),
    state,
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

function getNotionOAuthUrl(state: string): string {
  const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/coach/integrations/notion/callback`;

  if (!clientId) {
    throw new Error('NOTION_OAUTH_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    owner: 'user',
    state,
  });

  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

function getTodoistOAuthUrl(state: string, scopes: string[]): string {
  const clientId = process.env.TODOIST_OAUTH_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/coach/integrations/todoist/callback`;

  if (!clientId) {
    throw new Error('TODOIST_OAUTH_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(','),
    state,
  });

  return `https://todoist.com/oauth/authorize?${params.toString()}`;
}

function getAsanaOAuthUrl(state: string): string {
  const clientId = process.env.ASANA_OAUTH_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/coach/integrations/asana/callback`;

  if (!clientId) {
    throw new Error('ASANA_OAUTH_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });

  return `https://app.asana.com/-/oauth_authorize?${params.toString()}`;
}

function getSlackOAuthUrl(state: string, scopes: string[]): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/coach/integrations/slack/callback`;

  if (!clientId) {
    throw new Error('SLACK_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(','),
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

function getAirtableOAuthUrl(state: string, scopes: string[]): string {
  const clientId = process.env.AIRTABLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/coach/integrations/airtable/callback`;

  if (!clientId) {
    throw new Error('AIRTABLE_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
  });

  return `https://airtable.com/oauth2/v1/authorize?${params.toString()}`;
}

function getZoomOAuthUrl(state: string): string {
  const clientId = process.env.ZOOM_OAUTH_CLIENT_ID;
  // Use calendar subdomain for OAuth callbacks to avoid auth issues on subdomains
  const baseUrl = process.env.ZOOM_OAUTH_REDIRECT_BASE_URL || 'https://calendar.coachful.co';
  const redirectUri = `${baseUrl}/api/coach/integrations/zoom/callback`;

  if (!clientId) {
    throw new Error('ZOOM_OAUTH_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });

  return `https://zoom.us/oauth/authorize?${params.toString()}`;
}
