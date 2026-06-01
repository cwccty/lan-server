export function Stepper({ step }: { step: number }) {
  return <div className="stepper">当前步骤：{step} / 5</div>;
}
