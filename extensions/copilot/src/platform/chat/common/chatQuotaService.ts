/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createServiceIdentifier } from '../../../util/common/services';
import { Event } from '../../../util/vs/base/common/event';
import { IHeaders } from '../../networking/common/fetcherService';
import type { APIUsage } from '../../networking/common/openai';

/**
 * Accumulated token + billing usage for the current extension session. Fed from
 * each successful chat completion's `usage` block (see chatMLFetcher), this powers
 * the session cost status bar item. `nanoAiu` are Copilot billing units where
 * 1 AIC = 1_000_000_000 nano-AIU; cost data is approximate (see Copilot docs).
 */
export interface ISessionUsageTotals {
	readonly requestCount: number;
	readonly promptTokens: number;
	readonly completionTokens: number;
	readonly totalTokens: number;
	readonly cachedTokens: number;
	readonly nanoAiu: number;
	/** The most recent request's usage, for a "this chat" readout. */
	readonly last: {
		readonly promptTokens: number;
		readonly completionTokens: number;
		readonly totalTokens: number;
		readonly nanoAiu: number;
	} | undefined;
}

/**
 * This is the quota info we get from the `copilot_internal/user` endpoint.
 * It is accessed via the copilot token object
 */
export interface CopilotUserQuotaInfo {
	quota_reset_date?: string;
	quota_snapshots?: {
		chat: {
			quota_id: string;
			entitlement: number;
			remaining: number;
			unlimited: boolean;
			overage_count: number;
			overage_permitted: boolean;
			percent_remaining: number;
			has_quota?: boolean;
		};
		completions: {
			quota_id: string;
			entitlement: number;
			remaining: number;
			unlimited: boolean;
			overage_count: number;
			overage_permitted: boolean;
			percent_remaining: number;
			has_quota?: boolean;
		};
		premium_interactions: {
			quota_id: string;
			entitlement: number;
			remaining: number;
			unlimited: boolean;
			overage_count: number;
			overage_permitted: boolean;
			percent_remaining: number;
			has_quota?: boolean;
		};
	};
}

export interface IChatQuota {
	quota: number;
	percentRemaining: number;
	unlimited: boolean;
	hasQuota: boolean;
	additionalUsageUsed: number;
	additionalUsageEnabled: boolean;
	resetDate: Date;
}

export interface QuotaSnapshot {
	/** String representation of the entitlement count, "-1" for unlimited. */
	readonly entitlement: string;
	/** Percentage of quota remaining (0–100), rounded up to 1 decimal. */
	readonly percent_remaining: number;
	/** Whether additional usage (usage beyond included credits) is permitted. */
	readonly overage_permitted: boolean;
	/** Number of additional usage units consumed, rounded up to 1 decimal. */
	readonly overage_count: number;
	/** Whether the user has active quota for this category. */
	readonly has_quota?: boolean;
	/** ISO 8601 date when the quota resets, if applicable. */
	readonly reset_date?: string;
}

export type QuotaSnapshots = Record<string, QuotaSnapshot>;

export interface IChatQuotaService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	readonly quotaInfo: IChatQuota | undefined;
	readonly rateLimitInfo: { readonly session: IChatQuota | undefined; readonly weekly: IChatQuota | undefined };
	quotaExhausted: boolean;
	additionalUsageEnabled: boolean;
	/** AIC credits accumulated for the given turn, from copilot_usage.total_nano_aiu. */
	getCreditsForTurn(turnId: string): number | undefined;
	processQuotaHeaders(headers: IHeaders): void;
	processQuotaSnapshots(snapshots: QuotaSnapshots): void;
	/** Accumulate per-request cost from copilot_usage.total_nano_aiu (in nano-AIUs), scoped to a turn. */
	setLastCopilotUsage(totalNanoAiu: number, turnId: string): void;
	/** Reset accumulated credits for the given turn. */
	resetTurnCredits(turnId: string): void;
	/** Running token + AIU totals for this session, shown in the cost status bar item. */
	readonly sessionUsage: ISessionUsageTotals;
	/** Add one successful completion's usage to the running session totals. Fires onDidChange. */
	recordSessionUsage(usage: APIUsage): void;
	/** Clear the running session usage totals. Fires onDidChange. */
	resetSessionUsage(): void;
	clearQuota(): void;
	/**
	 * Fetches up-to-date quota data from the `copilot_internal/user` endpoint.
	 * Errors are caught and logged.
	 */
	refreshQuota(): Promise<void>;
}

export const IChatQuotaService = createServiceIdentifier<IChatQuotaService>('IChatQuotaService');
