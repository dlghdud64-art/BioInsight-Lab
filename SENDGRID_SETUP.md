# SendGrid Inbound Parse Setup Guide

This guide explains how to set up SendGrid Inbound Parse for automatic quote reply collection via email.

## Overview

The system allows vendors to reply to quote requests via email. When they send an email to a special address (e.g., `rfq+abc123@inbound.yourdomain.com`), the system automatically:

1. Receives the email via SendGrid Inbound Parse webhook
2. Extracts the RFQ token from the recipient address
3. Matches the token to a quote
4. Saves the reply with attachments
5. Falls back to unmatched inbox if no match found

## Database Schema

### Tables Added

1. **QuoteRfqToken**: RFQ tokens for email-based replies
   - One unique token per quote
   - Can be enabled/disabled
   - Optional expiration date

2. **InboundEmail**: Log of all received emails
   - Stores complete email data
   - Status: MATCHED, UNMATCHED, or FAILED
   - Deduplication via messageId

3. **QuoteReply**: Vendor replies to quotes
   - Linked to quote via quoteId
   - Stores email body (text and HTML)
   - Tracks sender email and timestamp

4. **QuoteReplyAttachment**: Attachments for replies
   - Stored in Supabase Storage (bucket: "quote-replies")
   - Metadata includes filename, size, content type

## Environment Variables

Add these to your `.env` file:

```bash
# SendGrid Inbound Parse webhook secret
SENDGRID_INBOUND_SECRET=your-random-secret-here

# Your domain for email addresses
NEXT_PUBLIC_DOMAIN=yourdomain.com
```

Generate a strong random secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## SendGrid Configuration

### 1. Set up Inbound Parse in SendGrid

1. Go to SendGrid Dashboard → Settings → Inbound Parse
2. Click "Add Host & URL"
3. Configure:
   - **Domain**: `inbound.yourdomain.com`
   - **URL**: `https://yourdomain.com/api/inbound/sendgrid/YOUR_SECRET_HERE`
   - **Check spam**: Yes (recommended)
   - **Send raw**: No
   - **POST raw MIME**: No

### 2. DNS Configuration

Add MX record to your DNS:

```
Type: MX
Host: inbound.yourdomain.com
Value: mx.sendgrid.net
Priority: 10
TTL: 3600
```

Verify the MX record:
```bash
nslookup -type=MX inbound.yourdomain.com
```

### 3. Test Configuration

SendGrid provides a test tool in the Inbound Parse settings to verify the webhook URL is accessible.

## API Endpoints

### 1. Generate RFQ Token

**POST** `/api/quotes/{quoteId}/rfq-token`

Creates or retrieves RFQ token for a quote.

**Response:**
```json
{
  "token": "abc123...",
  "replyAddress": "rfq+abc123@inbound.yourdomain.com",
  "enabled": true,
  "expiresAt": null,
  "createdAt": "2024-12-24T..."
}
```

**GET** `/api/quotes/{quoteId}/rfq-token`

Retrieves existing token (404 if none exists).

**PATCH** `/api/quotes/{quoteId}/rfq-token`

Update token settings:
```json
{
  "enabled": false,
  "expiresAt": "2025-01-31T23:59:59Z"
}
```

### 2. Inbound Webhook (SendGrid)

**POST** `/api/inbound/sendgrid/{secret}`

Receives emails from SendGrid. Returns:
- `200 OK { ok: true, matched: true }` - Successfully matched
- `200 OK { ok: true, matched: false }` - Saved as unmatched
- `200 OK { ok: true, deduped: true }` - Duplicate email

**Security:**
- URL secret must match `SENDGRID_INBOUND_SECRET`
- Returns 401 if secret doesn't match

**Deduplication:**
- Uses email Message-ID header
- Prevents processing same email twice

### 3. Admin: Unmatched Inbox

**GET** `/api/admin/inbound-emails?status=UNMATCHED&page=1&limit=50`

List unmatched emails.

**Query Params:**
- `status`: MATCHED | UNMATCHED | FAILED
- `page`: Page number (default: 1)
- `limit`: Results per page (max: 100)

**Response:**
```json
{
  "emails": [...],
  "totalCount": 42,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

**POST** `/api/admin/inbound-emails/{emailId}/attach-to-quote`

Manually attach unmatched email to a quote.

**Body:**
```json
{
  "quoteId": "clxyz123..."
}
```

**Response:**
```json
{
  "success": true,
  "replyId": "clxyz456...",
  "quoteId": "clxyz123..."
}
```

## Testing

### 1. Local Testing with ngrok

Since SendGrid needs a public URL, use ngrok for local development:

```bash
# Start your dev server
npm run dev

# In another terminal, start ngrok
ngrok http 3000

# Use the ngrok URL in SendGrid configuration
# https://abc123.ngrok.io/api/inbound/sendgrid/YOUR_SECRET
```

### 2. Manual Test with curl

Simulate a SendGrid webhook payload:

```bash
curl -X POST "http://localhost:3000/api/inbound/sendgrid/YOUR_SECRET" \
  -F "to=rfq+YOUR_TOKEN@inbound.yourdomain.com" \
  -F "from=vendor@example.com" \
  -F "subject=Re: Quote Request #123" \
  -F "text=Here is our quote response..." \
  -F "html=<p>Here is our quote response...</p>" \
  -F "headers=Message-ID: <abc@example.com>"
```

### 3. Test with Real Email

1. Generate RFQ token for a test quote
2. Send email to the reply address: `rfq+TOKEN@inbound.yourdomain.com`
3. Check logs to verify webhook received
4. Verify QuoteReply was created in database

### 4. Test Attachment Upload

```bash
curl -X POST "http://localhost:3000/api/inbound/sendgrid/YOUR_SECRET" \
  -F "to=rfq+YOUR_TOKEN@inbound.yourdomain.com" \
  -F "from=vendor@example.com" \
  -F "subject=Quote with PDF" \
  -F "text=See attached quote" \
  -F "attachment1=@./test-quote.pdf"
```

## Workflow Example

### Sending RFQ to Vendor

1. User creates a quote in the system
2. User clicks "Generate Email Reply Address"
3. System creates RFQ token via `POST /api/quotes/{id}/rfq-token`
4. User includes reply address in email to vendor:
   ```
   Please send your quote to: rfq+abc123@inbound.yourdomain.com
   ```

### Vendor Replies

1. Vendor sends email to `rfq+abc123@inbound.yourdomain.com`
2. SendGrid receives email and POSTs to webhook
3. System extracts token `abc123` from recipient address
4. System looks up token in QuoteRfqToken table
5. If matched:
   - Creates QuoteReply record
   - Uploads attachments to Supabase Storage
   - Creates QuoteReplyAttachment records
   - Marks InboundEmail as MATCHED
6. If not matched:
   - Saves InboundEmail as UNMATCHED
   - Admin can manually attach later

### Admin Reviews Unmatched

1. Admin opens unmatched inbox
2. Admin reviews email details
3. Admin manually attaches to correct quote
4. System creates QuoteReply from email data

## Storage Configuration (TODO)

Attachment upload to Supabase Storage is not yet implemented. To complete:

1. Install Supabase client:
   ```bash
   npm install @supabase/supabase-js
   ```

2. Add environment variables:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. Create storage bucket in Supabase:
   - Name: `quote-replies`
   - Public: No (private)

4. Update `uploadAttachment()` function in webhook endpoint with actual upload code.

## Security Considerations

1. **Webhook Secret**: Keep `SENDGRID_INBOUND_SECRET` secure
2. **Token Length**: Tokens are 32-48 chars (base64url) = 192-288 bits entropy
3. **Token Expiration**: Set `expiresAt` for time-limited tokens
4. **Token Disabling**: Set `enabled=false` to prevent abuse
5. **Admin Access**: Only ADMIN role can access unmatched inbox
6. **Rate Limiting**: Consider adding rate limits to webhook endpoint

## Monitoring

Key metrics to monitor:

1. **Match Rate**: % of emails successfully matched
2. **Unmatched Queue**: Number of unmatched emails awaiting review
3. **Webhook Errors**: Failed webhook processing attempts
4. **Duplicate Rate**: Emails caught by deduplication

Log locations:
- Webhook processing: `api/inbound/sendgrid` logger
- Token generation: `api/quotes/[id]/rfq-token` logger
- Admin actions: `api/admin/inbound-emails` logger

## Troubleshooting

### Email not received

1. Check MX record configuration:
   ```bash
   dig MX inbound.yourdomain.com
   ```

2. Verify SendGrid webhook URL is correct

3. Check webhook secret matches environment variable

4. Review SendGrid activity log

### Token not matching

1. Verify token format in email address
2. Check token is enabled (`enabled=true`)
3. Verify token hasn't expired
4. Check exact token value in database

### Attachments not uploading

1. Check file size (max 10MB per attachment)
2. Verify Supabase credentials
3. Check storage bucket exists and has correct permissions
4. Review error logs

## Future Enhancements

- [ ] Implement Supabase Storage upload
- [ ] Add email notification when reply received
- [ ] Auto-extract vendor name from email domain
- [ ] Parse structured quote data from email body
- [ ] Support multiple reply addresses per quote
- [ ] Add webhook retry logic for transient failures
- [ ] Implement rate limiting
- [ ] Add email templates for RFQ sending
