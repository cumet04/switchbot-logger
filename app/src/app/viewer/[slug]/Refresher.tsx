"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const Refresher = (props: { minutes: number }) => {
  const router = useRouter();

  const now = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    timeStyle: "short",
    dateStyle: "short",
  });

  // window依存のsetIntervalを使うため、useEffectでclient onlyにする。
  // MEMO: use clientはclient「でも」renderするもので、client「でしか」renderしないというものではない
  useEffect(() => {
    setInterval(
      () => {
        router.refresh();
      },
      1000 * 60 * props.minutes
    );
  }, [props.minutes, router]);

  return <p>at {now}</p>;
};
