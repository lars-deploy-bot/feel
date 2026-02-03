# RFC: Multi-Channel Messaging (WhatsApp/Telegram/Discord)

**Status:** Draft
**RFC ID:** RFC-2026-002
**Author:** Lars / Claude
**Created:** 2026-02-01

---

## Summary

Users can manage their website by messaging on WhatsApp, Telegram, or Discord instead of opening the web interface. "Update my homepage" via WhatsApp. "Add a new blog post" via Telegram. Meet users where they already are.

## Problem

Users have to actively visit our web interface to make changes. They forget about their site. They don't want "another app." OpenClaw proved that messaging-first AI assistants feel more natural and get more engagement.

**User quote pattern:** "I want to text my website updates like I text a friend."

## User Stories

1. **Quick update:** User sends WhatsApp message "Change the phone number on contact page to 555-1234" → Site updates
2. **Check status:** User sends "Is my site working?" → Gets uptime report
3. **Content addition:** User sends photo + "Add this to the gallery" → Photo appears on site
4. **Seamless context:** User discusses site in Telegram, then continues conversation on web → Same memory

## Decisions Needed

| Question | Options | Recommendation |
|----------|---------|----------------|
| Which channels first? | WhatsApp, Telegram, Discord, all | **Telegram first** - easiest API, no business verification |
| Bot per user or shared? | Dedicated bot per user, shared bot | **Shared bot** - easier onboarding, route by phone/user ID |
| Authentication | Phone number linking, magic link, OAuth | **Magic link** - user clicks link in first message to connect |
| Message handling | Direct to Claude, queue + batch | **Direct** - real-time feels better |
| Rate limiting | Per user, per channel, global | **Per user** - prevent abuse, fair usage |

## Technical Approach

### Architecture

```
User's Phone (WhatsApp/Telegram)
        ↓
   Message Broker (webhook receiver)
        ↓
   User Resolution (phone → userId → workspace)
        ↓
   Claude Agent (same as web, different transport)
        ↓
   Response sent back to messaging channel
```

### Channel Integrations

**Telegram (Phase 1):**
- Use Telegram Bot API
- Webhook receives messages at `/api/channels/telegram/webhook`
- grammY library for TypeScript
- No cost, no approval needed

**WhatsApp (Phase 2):**
- WhatsApp Business API via Meta
- Requires business verification
- Monthly costs apply
- Consider Twilio as intermediary

**Discord (Phase 3):**
- Discord.js bot
- Server/DM support
- Free, easy setup

### User Linking Flow

1. User visits web dashboard, clicks "Connect WhatsApp/Telegram"
2. We show QR code or deep link to start conversation with our bot
3. User sends first message (anything)
4. We send magic link back: "Click to connect this chat to your site: [link]"
5. User clicks, we associate their channel ID with their user account
6. Future messages route to their workspace automatically

### Message Processing

```typescript
interface IncomingChannelMessage {
  channelType: 'telegram' | 'whatsapp' | 'discord'
  channelUserId: string  // e.g., Telegram user ID
  messageText: string
  attachments?: Attachment[]
  timestamp: Date
}

// Resolve to our user
const user = await resolveUserFromChannel(message.channelType, message.channelUserId)
if (!user) {
  return sendLinkingPrompt(message)
}

// Process like web request
const response = await claudeAgent.chat({
  userId: user.id,
  workspace: user.defaultWorkspace,
  message: message.messageText,
  attachments: message.attachments,
  source: 'telegram'
})

// Send response back
await sendToChannel(message.channelType, message.channelUserId, response)
```

## Database Changes

```sql
-- New table: channel_connections
CREATE TABLE channel_connections (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  channel_type TEXT NOT NULL,  -- 'telegram', 'whatsapp', 'discord'
  channel_user_id TEXT NOT NULL,  -- platform-specific user ID
  channel_username TEXT,  -- optional display name
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(channel_type, channel_user_id)
);

-- Index for fast lookup
CREATE INDEX idx_channel_lookup ON channel_connections(channel_type, channel_user_id);
```

## Security Considerations

1. **Verification:** Magic link prevents anyone from claiming to be a user
2. **Rate limiting:** Prevent spam/abuse per channel user
3. **Content moderation:** Same rules as web interface
4. **Disconnect:** User can unlink channel anytime from dashboard
5. **Prompt injection:** External messages wrapped with security boundaries (learn from OpenClaw's `external-content.ts`)

## Success Metrics

- % of users who connect at least one channel
- Messages sent via channel vs web interface
- User retention (hypothesis: messaging users stay longer)
- Response time (should feel instant)

## Effort Estimate

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | Telegram integration | 2-3 days |
| Phase 2 | WhatsApp integration | 1 week (includes business verification) |
| Phase 3 | Discord integration | 2-3 days |
| Total | All channels | ~2 weeks |

## Open Questions

1. Do we need separate "workspace" selection for multi-site users?
2. Should channel messages appear in web chat history?
3. How to handle media (images, voice notes) from messaging apps?
4. Billing implications - do channel messages count toward usage?

## References

- [OpenClaw Channels Documentation](https://docs.openclaw.ai/channels)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [grammY Framework](https://grammy.dev/)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
