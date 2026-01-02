/**
 * Notion Integration
 * 
 * Handles exporting client progress, session notes, and check-in data to Notion.
 */

import { 
  getIntegration, 
  updateSyncStatus,
} from './token-manager';
import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { NotionSettings, NotionExportRecord } from './types';

// =============================================================================
// TYPES
// =============================================================================

interface ClientData {
  userId: string;
  name: string;
  email?: string;
  joinedAt?: string;
  currentGoal?: string;
  streakDays?: number;
  programEnrollments?: string[];
  squadMemberships?: string[];
}

interface SessionNoteData {
  sessionId: string;
  clientName: string;
  sessionDate: string;
  durationMinutes?: number;
  notes: string;
  keyPoints?: string[];
  actionItems?: string[];
  nextSteps?: string;
}

interface CheckinSummaryData {
  clientUserId: string;
  clientName: string;
  date: string;
  type: 'morning' | 'evening';
  mood?: number;
  energy?: number;
  gratitude?: string[];
  intentions?: string[];
  wins?: string[];
  challenges?: string[];
  notes?: string;
}

interface GoalData {
  goalId: string;
  clientUserId: string;
  clientName: string;
  title: string;
  description?: string;
  status: 'active' | 'achieved' | 'abandoned';
  createdAt: string;
  targetDate?: string;
  achievedAt?: string;
  milestones?: string[];
}

// =============================================================================
// NOTION API HELPERS
// =============================================================================

const NOTION_API_VERSION = '2022-06-28';

/**
 * Make a request to Notion API
 */
async function notionRequest(
  accessToken: string,
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || 'Notion API error' };
    }

    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// =============================================================================
// CLIENT DATABASE MANAGEMENT
// =============================================================================

/**
 * Create or get clients database in Notion
 */
export async function ensureClientsDatabase(
  orgId: string
): Promise<{ success: boolean; databaseId?: string; error?: string }> {
  try {
    const integration = await getIntegration(orgId, 'notion', true);
    
    if (!integration || integration.status !== 'connected') {
      return { success: false, error: 'Notion not connected' };
    }

    const settings = integration.settings as NotionSettings;

    // If database ID already exists, verify it's still valid
    if (settings.databaseId) {
      const verify = await notionRequest(
        integration.accessToken,
        `/databases/${settings.databaseId}`
      );
      if (verify.success) {
        return { success: true, databaseId: settings.databaseId };
      }
    }

    // Find a page to create database in (use workspace root)
    // Note: Notion API requires parent page ID to create a database
    // In production, you'd want the coach to select a page
    
    // Search for pages the integration has access to
    const searchResult = await notionRequest(
      integration.accessToken,
      '/search',
      'POST',
      {
        filter: {
          property: 'object',
          value: 'page',
        },
        page_size: 1,
      }
    );

    if (!searchResult.success || !(searchResult.data as { results?: unknown[] })?.results?.length) {
      return { 
        success: false, 
        error: 'No accessible pages found in Notion. Please share a page with the integration.' 
      };
    }

    const parentPageId = ((searchResult.data as { results: Array<{ id: string }> }).results[0]).id;

    // Create clients database
    const createResult = await notionRequest(
      integration.accessToken,
      '/databases',
      'POST',
      {
        parent: { type: 'page_id', page_id: parentPageId },
        title: [{ type: 'text', text: { content: 'Coaching Clients' } }],
        properties: {
          Name: { title: {} },
          Email: { email: {} },
          'Joined Date': { date: {} },
          'Current Goal': { rich_text: {} },
          'Streak Days': { number: {} },
          Status: {
            select: {
              options: [
                { name: 'Active', color: 'green' },
                { name: 'Inactive', color: 'gray' },
                { name: 'Completed', color: 'blue' },
              ],
            },
          },
        },
      }
    );

    if (!createResult.success) {
      return { success: false, error: createResult.error };
    }

    const databaseId = (createResult.data as { id: string }).id;

    // Update integration settings with database ID
    await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('integrations')
      .where('provider', '==', 'notion')
      .get()
      .then(snapshot => {
        if (!snapshot.empty) {
          snapshot.docs[0].ref.update({
            'settings.databaseId': databaseId,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });

    return { success: true, databaseId };
  } catch (error) {
    console.error('[NOTION] Error ensuring clients database:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

/**
 * Export client to Notion
 */
export async function exportClientToNotion(
  orgId: string,
  client: ClientData
): Promise<{ success: boolean; pageId?: string; error?: string }> {
  try {
    const integration = await getIntegration(orgId, 'notion', true);
    
    if (!integration || integration.status !== 'connected') {
      return { success: false, error: 'Notion not connected' };
    }

    const settings = integration.settings as NotionSettings;

    // Ensure database exists
    let databaseId = settings.databaseId;
    if (!databaseId) {
      const dbResult = await ensureClientsDatabase(orgId);
      if (!dbResult.success) {
        return { success: false, error: dbResult.error };
      }
      databaseId = dbResult.databaseId;
    }

    // Check if client already exported
    const existingRecord = await getExportRecord(orgId, 'client', client.userId);
    
    if (existingRecord) {
      // Update existing page
      const updateResult = await notionRequest(
        integration.accessToken,
        `/pages/${existingRecord.notionPageId}`,
        'PATCH',
        {
          properties: {
            Name: { title: [{ text: { content: client.name } }] },
            Email: client.email ? { email: client.email } : undefined,
            'Current Goal': client.currentGoal 
              ? { rich_text: [{ text: { content: client.currentGoal } }] }
              : undefined,
            'Streak Days': client.streakDays !== undefined 
              ? { number: client.streakDays }
              : undefined,
          },
        }
      );

      if (updateResult.success) {
        await updateExportRecord(orgId, existingRecord.id);
        return { success: true, pageId: existingRecord.notionPageId };
      }
      return { success: false, error: updateResult.error };
    }

    // Create new page
    const createResult = await notionRequest(
      integration.accessToken,
      '/pages',
      'POST',
      {
        parent: { database_id: databaseId },
        properties: {
          Name: { title: [{ text: { content: client.name } }] },
          Email: client.email ? { email: client.email } : undefined,
          'Joined Date': client.joinedAt 
            ? { date: { start: client.joinedAt.split('T')[0] } }
            : undefined,
          'Current Goal': client.currentGoal 
            ? { rich_text: [{ text: { content: client.currentGoal } }] }
            : undefined,
          'Streak Days': client.streakDays !== undefined 
            ? { number: client.streakDays }
            : undefined,
          Status: { select: { name: 'Active' } },
        },
      }
    );

    if (!createResult.success) {
      return { success: false, error: createResult.error };
    }

    const pageId = (createResult.data as { id: string; url: string }).id;
    const pageUrl = (createResult.data as { id: string; url: string }).url;

    // Store export record
    await storeExportRecord(orgId, integration.id, 'client', client.userId, pageId, pageUrl);

    await updateSyncStatus(orgId, integration.id, 'success');

    return { success: true, pageId };
  } catch (error) {
    console.error('[NOTION] Error exporting client:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Export session notes to Notion
 */
export async function exportSessionNotesToNotion(
  orgId: string,
  session: SessionNoteData
): Promise<{ success: boolean; pageId?: string; error?: string }> {
  try {
    const integration = await getIntegration(orgId, 'notion', true);
    
    if (!integration || integration.status !== 'connected') {
      return { success: false, error: 'Notion not connected' };
    }

    const settings = integration.settings as NotionSettings;

    if (!settings.exportSessionNotes) {
      return { success: true }; // Export disabled
    }

    // Find parent page or database
    const parentResult = await notionRequest(
      integration.accessToken,
      '/search',
      'POST',
      {
        filter: { property: 'object', value: 'page' },
        page_size: 1,
      }
    );

    if (!parentResult.success || !(parentResult.data as { results?: unknown[] })?.results?.length) {
      return { success: false, error: 'No accessible pages found' };
    }

    const parentId = ((parentResult.data as { results: Array<{ id: string }> }).results[0]).id;

    // Build page content blocks
    const blocks: Array<Record<string, unknown>> = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Session Details' } }],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `Client: ${session.clientName}` } },
          ],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `Date: ${session.sessionDate}` } },
          ],
        },
      },
    ];

    if (session.durationMinutes) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `Duration: ${session.durationMinutes} minutes` } },
          ],
        },
      });
    }

    blocks.push({
      object: 'block',
      type: 'divider',
      divider: {},
    });

    blocks.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Notes' } }],
      },
    });

    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: session.notes } }],
      },
    });

    if (session.keyPoints?.length) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: 'Key Points' } }],
        },
      });
      for (const point of session.keyPoints) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: point } }],
          },
        });
      }
    }

    if (session.actionItems?.length) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: 'Action Items' } }],
        },
      });
      for (const item of session.actionItems) {
        blocks.push({
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ type: 'text', text: { content: item } }],
            checked: false,
          },
        });
      }
    }

    // Create page
    const createResult = await notionRequest(
      integration.accessToken,
      '/pages',
      'POST',
      {
        parent: { page_id: parentId },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: `Session with ${session.clientName} - ${session.sessionDate}`,
                },
              },
            ],
          },
        },
        children: blocks,
      }
    );

    if (!createResult.success) {
      return { success: false, error: createResult.error };
    }

    const pageId = (createResult.data as { id: string; url: string }).id;
    const pageUrl = (createResult.data as { id: string; url: string }).url;

    await storeExportRecord(orgId, integration.id, 'session', session.sessionId, pageId, pageUrl);
    await updateSyncStatus(orgId, integration.id, 'success');

    return { success: true, pageId };
  } catch (error) {
    console.error('[NOTION] Error exporting session notes:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Export check-in summary to Notion
 */
export async function exportCheckinToNotion(
  orgId: string,
  checkin: CheckinSummaryData
): Promise<{ success: boolean; pageId?: string; error?: string }> {
  try {
    const integration = await getIntegration(orgId, 'notion', true);
    
    if (!integration || integration.status !== 'connected') {
      return { success: false, error: 'Notion not connected' };
    }

    const settings = integration.settings as NotionSettings;

    if (!settings.exportCheckins) {
      return { success: true }; // Export disabled
    }

    // Find parent page
    const parentResult = await notionRequest(
      integration.accessToken,
      '/search',
      'POST',
      {
        filter: { property: 'object', value: 'page' },
        page_size: 1,
      }
    );

    if (!parentResult.success || !(parentResult.data as { results?: unknown[] })?.results?.length) {
      return { success: false, error: 'No accessible pages found' };
    }

    const parentId = ((parentResult.data as { results: Array<{ id: string }> }).results[0]).id;

    // Build blocks
    const blocks: Array<Record<string, unknown>> = [];

    if (checkin.mood !== undefined || checkin.energy !== undefined) {
      blocks.push({
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: `Mood: ${checkin.mood || '?'}/10 | Energy: ${checkin.energy || '?'}/10`,
              },
            },
          ],
          icon: { emoji: checkin.type === 'morning' ? '🌅' : '🌙' },
        },
      });
    }

    if (checkin.gratitude?.length) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: 'Gratitude' } }],
        },
      });
      for (const item of checkin.gratitude) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: item } }],
          },
        });
      }
    }

    if (checkin.intentions?.length) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: 'Intentions' } }],
        },
      });
      for (const item of checkin.intentions) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: item } }],
          },
        });
      }
    }

    if (checkin.wins?.length) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: 'Wins' } }],
        },
      });
      for (const item of checkin.wins) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: item } }],
          },
        });
      }
    }

    if (checkin.notes) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: checkin.notes } }],
        },
      });
    }

    // Create page
    const checkinId = `${checkin.clientUserId}-${checkin.date}-${checkin.type}`;
    
    const createResult = await notionRequest(
      integration.accessToken,
      '/pages',
      'POST',
      {
        parent: { page_id: parentId },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: `${checkin.clientName} - ${checkin.type === 'morning' ? 'Morning' : 'Evening'} Check-in - ${checkin.date}`,
                },
              },
            ],
          },
        },
        children: blocks,
      }
    );

    if (!createResult.success) {
      return { success: false, error: createResult.error };
    }

    const pageId = (createResult.data as { id: string; url: string }).id;
    const pageUrl = (createResult.data as { id: string; url: string }).url;

    await storeExportRecord(orgId, integration.id, 'checkin', checkinId, pageId, pageUrl);
    await updateSyncStatus(orgId, integration.id, 'success');

    return { success: true, pageId };
  } catch (error) {
    console.error('[NOTION] Error exporting checkin:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Export goal to Notion
 */
export async function exportGoalToNotion(
  orgId: string,
  goal: GoalData
): Promise<{ success: boolean; pageId?: string; error?: string }> {
  try {
    const integration = await getIntegration(orgId, 'notion', true);
    
    if (!integration || integration.status !== 'connected') {
      return { success: false, error: 'Notion not connected' };
    }

    // Find parent page
    const parentResult = await notionRequest(
      integration.accessToken,
      '/search',
      'POST',
      {
        filter: { property: 'object', value: 'page' },
        page_size: 1,
      }
    );

    if (!parentResult.success || !(parentResult.data as { results?: unknown[] })?.results?.length) {
      return { success: false, error: 'No accessible pages found' };
    }

    const parentId = ((parentResult.data as { results: Array<{ id: string }> }).results[0]).id;

    // Build blocks
    const blocks: Array<Record<string, unknown>> = [
      {
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [
            { type: 'text', text: { content: `Status: ${goal.status.toUpperCase()}` } },
          ],
          icon: { emoji: goal.status === 'achieved' ? '🎉' : goal.status === 'active' ? '🎯' : '⏸️' },
        },
      },
    ];

    if (goal.description) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: goal.description } }],
        },
      });
    }

    if (goal.targetDate) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `Target Date: ${goal.targetDate}` } },
          ],
        },
      });
    }

    if (goal.milestones?.length) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: 'Milestones' } }],
        },
      });
      for (const milestone of goal.milestones) {
        blocks.push({
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ type: 'text', text: { content: milestone } }],
            checked: false,
          },
        });
      }
    }

    // Create page
    const createResult = await notionRequest(
      integration.accessToken,
      '/pages',
      'POST',
      {
        parent: { page_id: parentId },
        properties: {
          title: {
            title: [
              { text: { content: `${goal.clientName}: ${goal.title}` } },
            ],
          },
        },
        children: blocks,
      }
    );

    if (!createResult.success) {
      return { success: false, error: createResult.error };
    }

    const pageId = (createResult.data as { id: string; url: string }).id;
    const pageUrl = (createResult.data as { id: string; url: string }).url;

    await storeExportRecord(orgId, integration.id, 'goal', goal.goalId, pageId, pageUrl);
    await updateSyncStatus(orgId, integration.id, 'success');

    return { success: true, pageId };
  } catch (error) {
    console.error('[NOTION] Error exporting goal:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// =============================================================================
// EXPORT RECORDS
// =============================================================================

/**
 * Store export record
 */
async function storeExportRecord(
  orgId: string,
  integrationId: string,
  exportType: 'client' | 'session' | 'checkin' | 'goal',
  internalId: string,
  notionPageId: string,
  notionUrl: string
): Promise<void> {
  const exportsRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('notionExports');

  await exportsRef.add({
    integrationId,
    exportType,
    internalId,
    notionPageId,
    notionUrl,
    lastExportedAt: FieldValue.serverTimestamp(),
    exportHash: '', // Could add content hash for change detection
  });
}

/**
 * Get export record
 */
async function getExportRecord(
  orgId: string,
  exportType: 'client' | 'session' | 'checkin' | 'goal',
  internalId: string
): Promise<NotionExportRecord | null> {
  const snapshot = await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('notionExports')
    .where('exportType', '==', exportType)
    .where('internalId', '==', internalId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as NotionExportRecord;
}

/**
 * Update export record
 */
async function updateExportRecord(orgId: string, recordId: string): Promise<void> {
  const exportRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('notionExports')
    .doc(recordId);

  await exportRef.update({
    lastExportedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * List exports for organization
 */
export async function listNotionExports(
  orgId: string,
  limit = 50
): Promise<NotionExportRecord[]> {
  const snapshot = await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('notionExports')
    .orderBy('lastExportedAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as NotionExportRecord[];
}


