import "@fontsource/be-vietnam-pro/500.css";
import React, {useEffect, useState} from "react";
import {measureText} from "@remotion/layout-utils";
import {
  AbsoluteFill,
  Still,
  cancelRender,
  continueRender,
  delayRender,
  registerRoot,
} from "remotion";

const text = "Xử Nữ kiểm lỗi nhưng phụ đề phải đợi font.";

const Smoke: React.FC = () => {
  const [handle] = useState(() => delayRender("wait for Be Vietnam Pro"));
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const descriptor = '500 46px "Be Vietnam Pro"';
        const faces = await document.fonts.load(descriptor, text);
        await document.fonts.ready;
        if (!faces.length || !document.fonts.check(descriptor, text)) {
          throw new Error("Be Vietnam Pro did not become ready");
        }
        if (cancelled) return;
        setFontReady(true);
        requestAnimationFrame(() => continueRender(handle));
      } catch (error) {
        if (!cancelled) {
          cancelRender(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (!fontReady) {
    return <AbsoluteFill style={{backgroundColor: "#f3eadb"}} />;
  }

  const metrics = measureText({
    text,
    fontFamily: "Be Vietnam Pro",
    fontSize: 46,
    fontWeight: 500,
    validateFontIsLoaded: true,
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        backgroundColor: "#f3eadb",
        color: "#202020",
        fontFamily: "Be Vietnam Pro",
        fontSize: 46,
        fontWeight: 500,
        justifyContent: "center",
      }}
    >
      <div>{text}</div>
      <div style={{fontSize: 20}}>measured width: {metrics.width.toFixed(1)}</div>
    </AbsoluteFill>
  );
};

const Root: React.FC = () => (
  <Still id="Smoke" component={Smoke} width={1080} height={1920} />
);

registerRoot(Root);
