import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { addCorsHeaders } from '@/lib/cors-utils'

const LoginSchema = z.object({
	passcode: z.string().optional(),
})

export async function POST(req: NextRequest) {
	const origin = req.headers.get('origin')
	const body = await req.json().catch(() => ({}))
	const result = LoginSchema.safeParse(body)

	if (!result.success) {
		const res = NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
		addCorsHeaders(res, origin)
		return res
	}

	const { passcode } = result.data
	const need = process.env.BRIDGE_PASSCODE

	if (need && passcode !== need) {
		const res = NextResponse.json({ ok: false, error: 'bad_passcode' }, { status: 401 })
		addCorsHeaders(res, origin)
		return res
	}

	const res = NextResponse.json({ ok: true })
	res.cookies.set('session', '1', {
		httpOnly: true,
		secure: true,
		sameSite: 'none', // Changed for cross-origin
		path: '/',
	})
	addCorsHeaders(res, origin)
	return res
}

export async function OPTIONS(req: NextRequest) {
	const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/')
	const res = new NextResponse(null, { status: 200 })
	addCorsHeaders(res, origin)
	return res
}

