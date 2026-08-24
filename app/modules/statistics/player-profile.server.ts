import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database.generated";
import type { CompetitionContext } from "../competition/context";
import { PublicContextQueryError } from "../competition/context.server";
import { addPlayerTotals, type PlayerTotals } from "./player-profile-domain";

export interface PlayerCompetitionSummary extends PlayerTotals {
	context: CompetitionContext;
	teamName: string | null;
	teamSlug: string | null;
	jerseyNumber: string | null;
	position: string | null;
	starterAppearances: number;
}

export interface PublicPlayerProfileDto {
	id: number;
	fullName: string;
	slug: string;
	nickname: string | null;
	birthYear: number | null;
	bio: string | null;
	heightCm: number | null;
	weightKg: number | null;
	mainPosition: string | null;
	hand: string | null;
	homeCity: string | null;
	homeState: string | null;
	current: PlayerCompetitionSummary | null;
	career: PlayerTotals;
	competitions: PlayerCompetitionSummary[];
	honors: Array<{
		id: number;
		title: string;
		description: string | null;
		year: number | null;
		competitionName: string | null;
	}>;
	games: Array<{
		id: number;
		label: string;
		status: string;
		scheduledAt: string | null;
		context: CompetitionContext;
		teamName: string | null;
		jerseyNumber: string | null;
		points: number;
	}>;
}

function ensure(error: unknown): asserts error is null {
	if (error) throw new PublicContextQueryError();
}

function numberValue(value: number | null): number {
	return value ?? 0;
}

export async function loadPublicPlayerProfile(
	client: SupabaseClient<Database>,
	context: CompetitionContext,
	contexts: CompetitionContext[],
	slug: string,
): Promise<PublicPlayerProfileDto | null> {
	const profileResult = await client
		.from("public_player_profiles")
		.select(
			"id,full_name,slug,nickname,birth_year,bio,height_cm,weight_kg,main_position,hand,home_city,home_state,is_public",
		)
		.eq("slug", slug)
		.eq("is_public", true)
		.limit(2);
	ensure(profileResult.error);
	const profile =
		profileResult.data.length === 1 ? profileResult.data[0] : null;
	if (!profile?.id || !profile.full_name || !profile.slug) return null;

	const rosterResult = await client
		.from("roster_entries")
		.select("id")
		.eq("competition_id", context.competitionId)
		.eq("player_id", profile.id)
		.eq("status", "active")
		.limit(1);
	ensure(rosterResult.error);
	if (rosterResult.data.length !== 1) return null;

	const statisticsResult = await client
		.from("competition_player_statistics")
		.select("*")
		.eq("player_id", profile.id);
	ensure(statisticsResult.error);

	const contextById = new Map(
		contexts.map((item) => [item.competitionId, item]),
	);
	const competitions = statisticsResult.data
		.flatMap((row): PlayerCompetitionSummary[] => {
			const rowContext = row.competition_id
				? contextById.get(row.competition_id)
				: undefined;
			if (!rowContext) return [];
			return [
				{
					context: rowContext,
					teamName: row.team_name,
					teamSlug: row.team_slug,
					jerseyNumber: row.jersey_number,
					position: row.roster_position,
					starterAppearances: numberValue(row.starter_appearances),
					games: numberValue(row.games_played),
					points: numberValue(row.points),
					assists: numberValue(row.assists),
					rebounds:
						numberValue(row.offensive_rebounds) +
						numberValue(row.defensive_rebounds),
					steals: numberValue(row.steals),
					blocks: numberValue(row.blocks),
				},
			];
		})
		.sort(
			(left, right) =>
				right.context.year - left.context.year ||
				right.context.competitionId - left.context.competitionId,
		);

	const [honorsResult, gameStatisticsResult] = await Promise.all([
		client
			.from("player_honors")
			.select("id,title,description,year,competition_id,status,confirmed_at")
			.eq("player_id", profile.id)
			.eq("status", "confirmed")
			.not("confirmed_at", "is", null)
			.order("year", { ascending: false, nullsFirst: false }),
		client
			.from("game_player_statistics")
			.select("game_id,competition_id,team_name,jersey_number,points")
			.eq("player_id", profile.id),
	]);
	ensure(honorsResult.error);
	ensure(gameStatisticsResult.error);

	const gameIds = gameStatisticsResult.data.flatMap((row) =>
		row.game_id === null ? [] : [row.game_id],
	);
	const gameResult = gameIds.length
		? await client
				.from("games")
				.select("id,competition_id,game_number,status,scheduled_at")
				.in("id", gameIds)
				.in("status", ["live", "final"])
				.order("scheduled_at", { ascending: false, nullsFirst: false })
		: { data: [], error: null };
	ensure(gameResult.error);

	const statByGame = new Map(
		gameStatisticsResult.data.flatMap((row) =>
			row.game_id === null ? [] : ([[row.game_id, row]] as const),
		),
	);

	return {
		id: profile.id,
		fullName: profile.full_name,
		slug: profile.slug,
		nickname: profile.nickname,
		birthYear: profile.birth_year,
		bio: profile.bio,
		heightCm: profile.height_cm,
		weightKg: profile.weight_kg,
		mainPosition: profile.main_position,
		hand: profile.hand,
		homeCity: profile.home_city,
		homeState: profile.home_state,
		current:
			competitions.find(
				(item) => item.context.competitionId === context.competitionId,
			) ?? null,
		career: addPlayerTotals(competitions),
		competitions,
		honors: honorsResult.data.map((honor) => ({
			id: honor.id,
			title: honor.title,
			description: honor.description,
			year: honor.year,
			competitionName:
				honor.competition_id === null
					? null
					: (contextById.get(honor.competition_id)?.displayName ?? null),
		})),
		games: gameResult.data.flatMap((game) => {
			const rowContext = contextById.get(game.competition_id);
			const stats = statByGame.get(game.id);
			if (!rowContext || !stats) return [];
			return [
				{
					id: game.id,
					label: game.game_number
						? `Jogo ${game.game_number}`
						: `Jogo ${game.id}`,
					status: game.status,
					scheduledAt: game.scheduled_at,
					context: rowContext,
					teamName: stats.team_name,
					jerseyNumber: stats.jersey_number,
					points: numberValue(stats.points),
				},
			];
		}),
	};
}

