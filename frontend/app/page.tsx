import Link from "next/link";

type RequestType = {
  path: string;
  title: string;
  description: string;
  icon: string;
};

const requestTypes: RequestType[] = [
  {
    path: "/requests/new/building",
    title: "คำขอซ่อมแซมอาคาร",
    description: "ส่งคำขอซ่อมแซมหรือปรับปรุงอาคารสำนักงาน",
    icon: "🏢",
  },
  {
    path: "/requests/new/vehicle",
    title: "คำขอซ่อมรถยนต์",
    description: "ส่งคำขอซ่อมแซมหรือบริการรถยนต์บริษัท",
    icon: "🚗",
  },
  {
    path: "/requests/new/messenger",
    title: "คำขอใช้บริการส่งเอกสาร",
    description: "ขอใช้บริการส่งเอกสารหรือพัสดุภายในบริษัท",
    icon: "📬",
  },
  {
    path: "/requests/new/document",
    title: "คำขอเอกสาร",
    description: "ขอเอกสารต่างๆ เช่น ใบรับรอง ใบลา เป็นต้น",
    icon: "📄",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            ยินดีต้อนรับสู่ HR Buddy
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            ระบบจัดการคำขอและบริการสำหรับพนักงานบริษัท Construction Lines
            ส่งคำขอของคุณได้อย่างง่ายดายและติดตามสถานะได้แบบเรียลไทม์
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-12">
          {requestTypes.map((request) => (
            <Link
              key={request.path}
              href={request.path}
              className="group bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all duration-200"
            >
              <div className="text-3xl mb-4">{request.icon}</div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition">
                {request.title}
              </h3>
              <p className="text-sm text-slate-600">{request.description}</p>
            </Link>
          ))}
        </div>

        {/* My Requests Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                คำขอของฉัน
              </h2>
              <p className="text-slate-600 mt-1">
                ดูและติดตามสถานะคำขอที่คุณส่งแล้ว
              </p>
            </div>
            <Link
              href="/my-requests"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              ดูรายการทั้งหมด
            </Link>
          </div>

          {/* Placeholder for recent requests */}
          <div className="text-center py-8 text-slate-500">
            <div className="text-4xl mb-4">📋</div>
            <p>ยังไม่มีคำขอ เริ่มส่งคำขอแรกของคุณเลย!</p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-slate-500">
          <p>© 2026 Construction Lines - HR Buddy System</p>
        </div>
      </div>
    </main>
  );
}
