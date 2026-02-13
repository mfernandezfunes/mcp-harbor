import { Logger, initLogger, getLogger } from "../../src/utils/logger.js";

describe("Logger", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("debug", () => {
    it("should not log when debug is disabled", () => {
      const logger = new Logger("[Test]", false);
      logger.debug("test message");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should log when debug is enabled", () => {
      const logger = new Logger("[Test]", true);
      logger.debug("test message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Test] [DEBUG]",
        "test message"
      );
    });

    it("should log multiple arguments", () => {
      const logger = new Logger("[Test]", true);
      logger.debug("msg", { key: "value" });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Test] [DEBUG]",
        "msg",
        { key: "value" }
      );
    });
  });

  describe("info", () => {
    it("should always log regardless of debug flag", () => {
      const logger = new Logger("[Test]", false);
      logger.info("info message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Test] [INFO]",
        "info message"
      );
    });
  });

  describe("error", () => {
    it("should always log regardless of debug flag", () => {
      const logger = new Logger("[Test]", false);
      logger.error("error message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Test] [ERROR]",
        "error message"
      );
    });
  });

  describe("initLogger / getLogger", () => {
    it("should initialize and return a global logger", () => {
      const logger = initLogger(true);
      expect(logger).toBeInstanceOf(Logger);
      expect(getLogger()).toBe(logger);
    });

    it("should replace the global logger on re-init", () => {
      const first = initLogger(false);
      const second = initLogger(true);
      expect(getLogger()).toBe(second);
      expect(getLogger()).not.toBe(first);
    });
  });
});
