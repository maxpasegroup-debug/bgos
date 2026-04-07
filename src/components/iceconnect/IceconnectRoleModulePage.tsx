import { IceconnectWorkspaceView } from "@/components/iceconnect/IceconnectWorkspaceView";
import { IcPanel } from "@/components/iceconnect/IcPanel";

export function IceconnectRoleModulePage({
  title,
  subtitle,
  tools,
}: {
  title: string;
  subtitle: string;
  tools: readonly string[];
}) {
  return (
    <IceconnectWorkspaceView
      title={title}
      subtitle={subtitle}
      loading={false}
      error={null}
      onRetry={() => undefined}
    >
      <IcPanel title="Tools">
        <ul className="grid gap-2 sm:grid-cols-2">
          {tools.map((tool) => (
            <li
              key={tool}
              className="rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2 text-sm text-gray-700"
            >
              {tool}
            </li>
          ))}
        </ul>
      </IcPanel>
    </IceconnectWorkspaceView>
  );
}
