import axios from "axios";
import {
  FDROID_PACKAGE_API_URL,
  FDROID_PACKAGE_PAGE_URL,
  PLAY_STORE_APP_URL,
} from "../constants.js";

const DEFAULT_TIMEOUT = 10000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const checkPlayStore = async (packageName) => {
  const url = `${PLAY_STORE_APP_URL}?id=${encodeURIComponent(packageName)}&hl=en_US&gl=US`;

  try {
    const response = await axios.get(url, {
      timeout: DEFAULT_TIMEOUT,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      validateStatus: (status) => status === 200 || status === 404,
    });

    if (response.status !== 200) {
      return null;
    }

    return url;
  } catch (error) {
    console.warn(`Play Store lookup failed for ${packageName}:`, error.message);
    return null;
  }
};

const checkFdroid = async (packageName) => {
  const apiUrl = `${FDROID_PACKAGE_API_URL}/${encodeURIComponent(packageName)}`;

  try {
    const response = await axios.get(apiUrl, {
      timeout: DEFAULT_TIMEOUT,
      validateStatus: (status) => status === 200 || status === 404,
    });

    if (response.status !== 200 || !response.data) {
      return null;
    }

    const packageMatches =
      response.data.packageName?.toLowerCase() === packageName.toLowerCase();

    if (!packageMatches) {
      return null;
    }

    return `${FDROID_PACKAGE_PAGE_URL}/${encodeURIComponent(packageName)}/`;
  } catch (error) {
    console.warn(`F-Droid lookup failed for ${packageName}:`, error.message);
    return null;
  }
};

const linkExtractor = async (packageName) => {
  const [playStoreLink, fdroidLink] = await Promise.all([
    checkPlayStore(packageName),
    checkFdroid(packageName),
  ]);

  const links = [];

  if (playStoreLink) {
    links.push({ label: "Google Play", url: playStoreLink });
  }

  if (fdroidLink) {
    links.push({ label: "F-Droid", url: fdroidLink });
  }

  return links;
};

export default linkExtractor;
