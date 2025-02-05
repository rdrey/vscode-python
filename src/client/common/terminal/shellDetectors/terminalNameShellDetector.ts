// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { Terminal } from 'vscode';
import { traceVerbose } from '../../logger';
import { ShellIdentificationTelemetry, TerminalShellType } from '../types';
import { BaseShellDetector } from './baseShellDetector';

/**
 * Identifies the shell, based on the display name of the terminal.
 *
 * @export
 * @class TerminalNameShellDetector
 * @extends {BaseShellDetector}
 */
@injectable()
export class TerminalNameShellDetector extends BaseShellDetector {
    constructor() { super(0); }
    public identify(telemetryProperties: ShellIdentificationTelemetry, terminal?: Terminal): TerminalShellType | undefined {
        if (!terminal) {
            return;
        }
        const shell = this.identifyShellFromShellPath(terminal.name)
        traceVerbose(`Terminal name '${terminal.name}' identified as shell '${shell}'`);
        telemetryProperties.shellIdentificationSource = shell === TerminalShellType.other ? telemetryProperties.shellIdentificationSource : 'terminalName';
        return shell;
    }
}
