export default function DashboardLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        {/* Apple-style spinner: 8 bars fading in sequence */}
        <div className="relative h-8 w-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-0 h-full w-full"
              style={{ transform: `rotate(${i * 45}deg)` }}
            >
              <div
                className="mx-auto h-[22%] w-[7%] rounded-full bg-foreground"
                style={{
                  opacity: 0,
                  animation: "spinner-fade 0.8s linear infinite",
                  animationDelay: `${i * -0.1}s`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
