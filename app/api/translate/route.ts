import { translate } from 'google-translate-api-x';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text, targetLang } = await req.json();

    if (!text || !targetLang) {
      return NextResponse.json({ error: 'Missing text or targetLang' }, { status: 400 });
    }

    const res = await translate(text, { to: targetLang, forceBatch: false, rejectOnPartialFail: false });
    // @ts-ignore - we know response is not an array when input is a single string
    const translatedText = res.text;
    console.log(`Translated: "${text}" -> "${translatedText}" (${targetLang})`);
    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Translation error for text:', error);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
