import { useEffect } from "react";

type AnalyticsEventParameters = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? "";
const isValidMeasurementId = /^G-[A-Z0-9]+$/.test(measurementId);

export const trackAnalyticsEvent = (
  eventName: string,
  parameters: AnalyticsEventParameters = {},
) => {
  if (!isValidMeasurementId || !window.gtag) return;
  window.gtag("event", eventName, parameters);
};

const GoogleAnalytics = () => {
  useEffect(() => {
    if (
      !isValidMeasurementId ||
      document.getElementById("explora-google-analytics")
    ) {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer?.push(arguments);
    };

    window.gtag("js", new Date());
    window.gtag("config", measurementId);

    const script = document.createElement("script");
    script.id = "explora-google-analytics";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      measurementId,
    )}`;
    document.head.appendChild(script);
  }, []);

  return null;
};

export default GoogleAnalytics;
