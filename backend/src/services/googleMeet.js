/**
 * Google Meet service — mints real meet.google.com links through the
 * Google Calendar API using a service account.
 *
 * Requirements:
 *   - GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_KEY set
 *   - The service account must have "Make changes to events" access on the
 *     calendar in GOOGLE_CALENDAR_ID (default: its own "primary" calendar).
 *     For a shared department calendar, share it with the service account
 *     email and set GOOGLE_CALENDAR_ID to that calendar's id.
 *
 * Every class/session gets its own Calendar event, so each one has a unique,
 * stable Meet room that participants can rejoin.
 */

const { getGoogleApiAccessToken, isServiceAccountConfigured, calendarId } = require('./googleAuth');

const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

function addMinutes(iso, minutes) {
  const base = new Date(iso);
  if (isNaN(base.getTime())) return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return new Date(base.getTime() + minutes * 60000).toISOString();
}

/**
 * Create a Calendar event with an embedded Google Meet room.
 *
 * @param {object} options
 * @param {string} options.summary        Event title (shown in Meet)
 * @param {string} [options.description]  Event description
 * @param {string} options.startIso       Start time (ISO 8601)
 * @param {string} [options.endIso]       End time (defaults to start + durationMinutes)
 * @param {number} [options.durationMinutes]
 * @param {string[]} [options.attendees]  Attendee emails (optional)
 * @returns {Promise<{meetUrl:string, calendarEventId:string, calendarHtmlLink:string|null, source:'google'}>}
 */
async function createMeetEvent({ summary, description, startIso, endIso, durationMinutes, attendees = [] }) {
  if (!isServiceAccountConfigured()) {
    const err = new Error('Google Meet is not configured (service account missing).');
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }

  const token = await getGoogleApiAccessToken(CALENDAR_SCOPES);
  const body = {
    summary,
    description: description || undefined,
    start: { dateTime: startIso },
    end: { dateTime: endIso || addMinutes(startIso, Number(durationMinutes) || 60) },
    conferenceData: {
      createRequest: {
        requestId: `vishva-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };
  if (Array.isArray(attendees) && attendees.length) {
    body.attendees = attendees.filter(Boolean).map(email => ({ email }));
  }

  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId())}/events?conferenceDataVersion=1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `Google Calendar API error ${res.status}.`);
    err.status = res.status;
    throw err;
  }

  const meetUrl = data.hangoutLink
    || data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri
    || null;

  return {
    meetUrl,
    calendarEventId: data.id || null,
    calendarHtmlLink: data.htmlLink || null,
    source: 'google',
  };
}

/** Remove the backing Calendar event (used when a class/session is deleted). */
async function deleteMeetEvent(calendarEventId) {
  if (!calendarEventId || !isServiceAccountConfigured()) return false;
  try {
    const token = await getGoogleApiAccessToken(CALENDAR_SCOPES);
    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId())}/events/${encodeURIComponent(calendarEventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) },
    );
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

function meetConfigured() {
  return isServiceAccountConfigured();
}

module.exports = { createMeetEvent, deleteMeetEvent, meetConfigured };
