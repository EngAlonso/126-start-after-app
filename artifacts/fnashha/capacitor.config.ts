import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fnashha.app",
  appName: "Fnashha",
  webDir: "dist/public",

  server: {
    androidScheme: "https",
    cleartext: false,
  },

  plugins: {
    StatusBar: {
      style: "Default",
      backgroundColor: "#f5c518",
      overlaysWebView: false,
    },

    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#f5c518",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      iosSpinnerStyle: "small",
      spinnerColor: "#1a1a1a",
    },

    App: {
      launchUrl: "/",
    },
  },
};

export default config;
