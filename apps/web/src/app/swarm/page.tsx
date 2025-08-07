import { SwarmDashboard } from "@/components/swarm/swarm-dashboard";

export const metadata = {
	title: "Swarm Control Center | Solomon Codes",
	description: "LangGraph Swarm Control Center - Phase 3 Integration",
};

export default function SwarmPage() {
	return (
		<div className="h-screen overflow-hidden">
			<SwarmDashboard />
		</div>
	);
}
