"use client";
// Next.jsはサーバサイドレンダリングでclass componentのサポートを切っており、 https://nextjs.org/docs/messages/class-component-in-server-component
// rechartsはclass componentへの大きな依存があるため、use clientする必要がある
// refs https://github.com/recharts/recharts/issues/4336

import { useEffect } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type ChartRecord = { name: string } & { [key in string]: number };
export function Chart(props: { name: string; data: ChartRecord[] }) {
  const { name, data } = props;
  const keys = Object.keys(data[0]).filter((k) => k !== "name");
  return (
    <section>
      <h4>{name}</h4>
      <TurnOffDefaultPropsWarning />
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          {keys.map((k, i) => (
            <Line
              type="monotone"
              dot={false}
              isAnimationActive={false}
              key={k}
              dataKey={k}
              stroke={palette[i % palette.length]}
            />
          ))}
          <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
          {/* ticksを自前で指定して、N時ピッタリの軸にしたほうが見やすそう */}
          <XAxis dataKey="name" interval={50} fontSize={14} />
          <YAxis type="number" domain={["auto", "auto"]} fontSize={14} />
          <Tooltip
            // 縦軸のラベル値をいい感じに見やすくする。
            // 値の幅によっては45,50,55などちょうどいい整数が渡ってくるが、値の幅が小さい場合（特に気温）には
            // 小数点以下の非常に細かい値が入ることがある。
            // もともと整数の場合にはそのまま、そうでない場合は小数点以下1桁まで表示する。
            formatter={(v: number) => (Number.isInteger(v) ? v : v.toFixed(1))}
          />
          <Legend />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

// スプシの色テーマのスタンダードのをカラーピッカーで拾ってきた値
const palette = [
  "#4285f4",
  "#ea4335",
  "#34a853",
  "#ff6d01",
  "#46bdc6",
  "#fbbc04", // 黄色はちょっとみづらいので優先度を下げる
];

// アプリケーション側で回避不能な警告の抑制
// refs https://github.com/recharts/recharts/issues/3615#issuecomment-1987273931
function TurnOffDefaultPropsWarning() {
  useEffect(() => {
    const originalConsoleError = console.error;

    console.error = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("defaultProps")) {
        return;
      }
      originalConsoleError(...args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  return null;
}
