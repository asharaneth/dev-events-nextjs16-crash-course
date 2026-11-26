import posthog from "posthog-js";

export const eventDiscoveryLogger = {
  info(body: string, attributes?: Record<string, string>) {
    posthog.logger.info(body, attributes);
  },
};
