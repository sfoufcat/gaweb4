/**
 * Integration Configuration
 * 
 * Server-side only utilities for checking which integrations are configured.
 * This file should only be imported in server components or API routes.
 */

/**
 * Check which integration providers have their OAuth credentials configured.
 * Returns a map of provider ID to whether it's configured.
 */
export function getConfiguredIntegrations(): Record<string, boolean> {
  return {
    // OAuth-based integrations - require platform credentials
    google_calendar: !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    google_sheets: !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    outlook_calendar: !!(process.env.MICROSOFT_OAUTH_CLIENT_ID && process.env.MICROSOFT_OAUTH_CLIENT_SECRET),
    notion: !!(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET),
    airtable: !!(process.env.AIRTABLE_CLIENT_ID && process.env.AIRTABLE_CLIENT_SECRET),
    todoist: !!(process.env.TODOIST_CLIENT_ID && process.env.TODOIST_CLIENT_SECRET),
    asana: !!(process.env.ASANA_CLIENT_ID && process.env.ASANA_CLIENT_SECRET),
    slack: !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET),
    
    // Webhook-based integrations - coaches provide their own URLs, always available
    discord: true,
    zapier: true,
    make: true,
    
    // API key-based integrations - coaches provide their own keys, always available
    calcom: true,

    // Video meeting integrations
    zoom: !!(process.env.ZOOM_OAUTH_CLIENT_ID && process.env.ZOOM_OAUTH_CLIENT_SECRET),
    // Note: Google Meet is now part of google_calendar integration (enableMeetLinks toggle)
  };
}



