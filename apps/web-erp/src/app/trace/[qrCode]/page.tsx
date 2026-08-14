const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

interface Trace {
  container: {
    qrCode: string;
    containerType: string;
    variant: string;
    status: string;
  };
  bottlingRun: { runAt: string; chillerName: string } | null;
  chillerBlends: { farmName: string; farmVillage: string; percentContribution: number }[];
  qualityTrail: { recordedAt: string; fat: number; snf: number }[];
  temperatureTrail: { recordedAt: string; temperatureCelsius: number }[];
}

async function getTrace(qrCode: string): Promise<Trace | null> {
  const res = await fetch(`${API_BASE_URL}/public/trace/${encodeURIComponent(qrCode)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function TracePage(props: PageProps<"/trace/[qrCode]">) {
  const { qrCode } = await props.params;
  const trace = await getTrace(qrCode);

  if (!trace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <p className="text-gray-500">Ye container QR system me nahi mila.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-400">Desigo Milk Trail</p>
          <h1 className="mt-1 text-xl font-semibold">{trace.container.variant}</h1>
          <p className="text-sm text-gray-500">{trace.container.qrCode}</p>
        </div>

        {trace.chillerBlends.length > 0 && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Milk Origin</h2>
            <div className="space-y-2">
              {trace.chillerBlends.map((b, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div>
                    <p className="text-sm font-medium">{b.farmName}</p>
                    <p className="text-xs text-gray-500">{b.farmVillage}</p>
                  </div>
                  <p className="text-sm font-semibold text-green-700">
                    {b.percentContribution.toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {trace.qualityTrail.length > 0 && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Quality Checks</h2>
            <div className="space-y-2">
              {trace.qualityTrail.map((q, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm">
                  <span className="text-gray-500">{new Date(q.recordedAt).toLocaleDateString()}</span>
                  <span>
                    Fat {q.fat}% · SNF {q.snf}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {trace.bottlingRun && (
          <div className="rounded-2xl bg-white p-6 shadow-sm text-sm text-gray-500">
            Bottled at {trace.bottlingRun.chillerName} on{" "}
            {new Date(trace.bottlingRun.runAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}
