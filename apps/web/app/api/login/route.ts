import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const LoginSchema = z.object({
	passcode: z.string().optional(),
})

export async function POST(req: NextRequest) {
	const body = await req.json().catch(() => ({}))
	const result = LoginSchema.safeParse(body)

	if (!result.success) {
		return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
	}

	const { passcode } = result.data
	const need = process.env.BRIDGE_PASSCODE

	if (need && passcode !== need) {
		return NextResponse.json({ ok: false, error: 'bad_passcode' }, { status: 401 })
	}

	const res = NextResponse.json({ ok: true })
	res.cookies.set('session', '1', {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/',
	})
	return res
}
