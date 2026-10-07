import React, {createElement} from "react";
import type {CSSProperties} from "react";
import type {Primitive} from "./types";

const reactAttribute = (name: string): string => {
  if (name.startsWith("aria-") || name.startsWith("data-")) return name;
  if (name === "class") return "className";
  return name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
};

export const PrimitiveSvg: React.FC<{
  primitive: Primitive;
  allowedTags: string[];
  style: CSSProperties;
  label: string;
}> = ({primitive, allowedTags, style, label}) => (
  <svg
    role="img"
    aria-label={label}
    viewBox={primitive.viewBox}
    preserveAspectRatio="xMidYMid meet"
    width="100%"
    height="100%"
    style={style}
  >
    {primitive.elements.map((element, index) => {
      if (!allowedTags.includes(element.tag)) throw new Error("Undeclared SVG primitive tag: " + element.tag);
      const attributes: Record<string, string | number> = {};
      let textContent: string | undefined;
      for (const [name, value] of Object.entries(element.attributes)) {
        if (name === "text") textContent = String(value);
        else attributes[reactAttribute(name)] = value;
      }
      return createElement(element.tag, {...attributes, key: label + "-" + index}, textContent);
    })}
  </svg>
);
