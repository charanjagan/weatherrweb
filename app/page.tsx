import { AppProvider } from "@/app/components/store";
import WeatherApp from "@/app/components/WeatherApp";

export default function Home() {
  return (
    <AppProvider>
      <WeatherApp />
    </AppProvider>
  );
}
