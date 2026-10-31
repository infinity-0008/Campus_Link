import { KageLandingPage } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";

export default function Home() {
  return (
    <div className="shader-frame h-[calc(100dvh-4rem)] w-full bg-[#05070a]">
      <KageLandingPage
        headingFont="onest"
        bodyFont="onest"
        headingWeight="400"
        bodyWeight="300"
        primaryColor="#e0231c"
        headingSize={46}
        bodySize={17}
        headingLetterSpacing={-0.012}
      />
    </div>
  );
}
