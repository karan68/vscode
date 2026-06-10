/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { commands, MarkdownString, StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { IChatQuotaService } from '../../../platform/chat/common/chatQuotaService';
import { Disposable } from '../../../util/vs/base/common/lifecycle';
import { IExtensionContribution } from '../../common/contributions';

/**
 * Status bar item showing live token + AIU cost for the current chat session.
 *
 * Reads the real per-request `usage` reported by the Copilot service (tokens and
 * `copilot_usage.total_nano_aiu`), accumulated in IChatQuotaService.sessionUsage.
 * 1 AIC (AI credit) = 1_000_000_000 nano-AIU. Cost values are approximate — for
 * authoritative billing see your GitHub Copilot usage page.
 */
export class SessionCostStatusBarContribution extends Disposable implements IExtensionContribution {
	public readonly id = 'chat.sessionCost';

	private readonly _item: StatusBarItem;

	constructor(
		@IChatQuotaService private readonly _chatQuotaService: IChatQuotaService,
	) {
		super();

		this._item = this._register(window.createStatusBarItem('copilot.sessionCost', StatusBarAlignment.Right, -900));
		this._item.name = 'Copilot Session Cost';
		this._item.command = 'copilot.cost.resetSession';

		this._register(commands.registerCommand('copilot.cost.resetSession', () => {
			this._chatQuotaService.resetSessionUsage();
		}));

		this._register(this._chatQuotaService.onDidChange(() => this._update()));
		this._update();
	}

	private _update(): void {
		const u = this._chatQuotaService.sessionUsage;
		if (u.requestCount === 0) {
			this._item.hide();
			return;
		}

		const aic = u.nanoAiu / 1_000_000_000;
		const costPart = u.nanoAiu > 0 ? ` \u00b7 ${aic.toFixed(2)} AIC` : '';
		this._item.text = `$(graph) ${formatTokens(u.totalTokens)} tok${costPart}`;

		const md = new MarkdownString(undefined, true);
		md.appendMarkdown(`**Copilot session cost**\n\n`);
		md.appendMarkdown(`- Requests: **${u.requestCount}**\n`);
		md.appendMarkdown(`- Prompt tokens: **${u.promptTokens.toLocaleString()}**`);
		if (u.cachedTokens > 0) {
			md.appendMarkdown(` (${u.cachedTokens.toLocaleString()} cached)`);
		}
		md.appendMarkdown(`\n`);
		md.appendMarkdown(`- Completion tokens: **${u.completionTokens.toLocaleString()}**\n`);
		md.appendMarkdown(`- Total tokens: **${u.totalTokens.toLocaleString()}**\n`);
		if (u.nanoAiu > 0) {
			md.appendMarkdown(`- Cost: **${aic.toFixed(3)} AIC** (premium request credits)\n`);
		}
		if (u.last) {
			const lastAic = u.last.nanoAiu / 1_000_000_000;
			const lastCost = u.last.nanoAiu > 0 ? `, ${lastAic.toFixed(3)} AIC` : '';
			md.appendMarkdown(`\n_Last request:_ ${u.last.totalTokens.toLocaleString()} tokens${lastCost}\n`);
		}
		md.appendMarkdown(`\nClick to reset. Cost is approximate — see your GitHub Copilot usage page for billing.`);
		this._item.tooltip = md;

		this._item.show();
	}
}

function formatTokens(n: number): string {
	if (n >= 1_000_000) {
		return `${(n / 1_000_000).toFixed(1)}M`;
	}
	if (n >= 1_000) {
		return `${(n / 1_000).toFixed(1)}K`;
	}
	return `${n}`;
}
