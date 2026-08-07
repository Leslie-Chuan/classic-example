import { SKILLS } from "@/lib/constants";

export default function SkillMatrix() {
  const done = SKILLS.filter((s) => s.status === "done").length;
  const inProgress = SKILLS.filter((s) => s.status === "in_progress").length;

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-sm text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> 已掌握 {done}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 进行中 {inProgress}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" /> 待学习 {SKILLS.length - done - inProgress}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SKILLS.map((skill) => (
          <div
            key={skill.name}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              skill.status === "done"
                ? "bg-emerald-500/10 text-emerald-400"
                : skill.status === "in_progress"
                ? "bg-amber-500/10 text-amber-400"
                : "bg-zinc-800/50 text-zinc-500"
            }`}
          >
            <span className="text-base">
              {skill.status === "done" ? "✓" : skill.status === "in_progress" ? "~" : "○"}
            </span>
            <span>{skill.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
