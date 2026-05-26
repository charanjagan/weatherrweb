import dynamic from "next/dynamic";

const WeatherMap = dynamic(() => import("./WeatherMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Loading map…
      </p>
    </div>
  ),
});

export default WeatherMap;
