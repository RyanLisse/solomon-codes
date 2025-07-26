import TaskClientPage from "./client-page";

export const runtime = "edge";

interface Props {
	params: Promise<{ id: string }>;
}

export default async function TaskPage({ params }: Props) {
	const { id } = await params;

	return <TaskClientPage id={id} />;
}
