"use client";

import GoalieEventMapping, {
    GoalieEventMappingData,
} from "@/components/GoalieEventMapping";
import SkaterEventMapping, {
    SkaterEventMappingData,
} from "@/components/SkaterEventMapping";


export type EventMappingData =
    | SkaterEventMappingData
    | GoalieEventMappingData;


type Props = {
    data: EventMappingData;
};


export default function EventMappingPanel({
    data,
}: Props) {
    return (
        <div className="w-full min-w-0 max-w-full">
            {data.playerType === "goalie" ? (
                <GoalieEventMapping
                    data={data}
                />
            ) : (
                <SkaterEventMapping
                    data={data}
                />
            )}
        </div>
    );
}