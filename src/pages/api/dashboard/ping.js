/** GET /api/dashboard/ping — tells the client whether DASHBOARD_SECRET is configured */
export default function handler(req, res) {
  res.status(200).json({ secured: !!process.env.DASHBOARD_SECRET });
}
