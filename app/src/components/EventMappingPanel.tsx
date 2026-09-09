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
    if (data.playerType === "goalie") {
        return (
            <GoalieEventMapping
                data={data}
            />
        );
    }

    return (
        <SkaterEventMapping
            data={data}
        />
    );
}