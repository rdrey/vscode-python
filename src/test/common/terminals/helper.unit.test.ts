// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { expect } from 'chai';
import { SemVer } from 'semver';
import * as sinon from 'sinon';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { Terminal, Uri } from 'vscode';
import { TerminalManager } from '../../../client/common/application/terminalManager';
import { ITerminalManager } from '../../../client/common/application/types';
import { PythonSettings } from '../../../client/common/configSettings';
import { ConfigurationService } from '../../../client/common/configuration/service';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IPlatformService } from '../../../client/common/platform/types';
import { Bash } from '../../../client/common/terminal/environmentActivationProviders/bash';
import { CommandPromptAndPowerShell } from '../../../client/common/terminal/environmentActivationProviders/commandPrompt';
import {
    CondaActivationCommandProvider
} from '../../../client/common/terminal/environmentActivationProviders/condaActivationProvider';
import {
    PipEnvActivationCommandProvider
} from '../../../client/common/terminal/environmentActivationProviders/pipEnvActivationProvider';
import {
    PyEnvActivationCommandProvider
} from '../../../client/common/terminal/environmentActivationProviders/pyenvActivationProvider';
import { TerminalHelper } from '../../../client/common/terminal/helper';
import { ShellDetector } from '../../../client/common/terminal/shellDetector';
import { TerminalNameShellDetector } from '../../../client/common/terminal/shellDetectors/terminalNameShellDetector';
import {
    IShellDetector,
    ITerminalActivationCommandProvider,
    TerminalShellType
} from '../../../client/common/terminal/types';
import { IConfigurationService } from '../../../client/common/types';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { Architecture, OSType } from '../../../client/common/utils/platform';
import { ICondaService, InterpreterType, PythonInterpreter } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { CondaService } from '../../../client/interpreter/locators/services/condaService';

// tslint:disable:max-func-body-length no-any

suite('Terminal Service helpers', () => {
    let helper: TerminalHelper;
    let terminalManager: ITerminalManager;
    let platformService: IPlatformService;
    let condaService: ICondaService;
    let configurationService: IConfigurationService;
    let condaActivationProvider: ITerminalActivationCommandProvider;
    let bashActivationProvider: ITerminalActivationCommandProvider;
    let cmdActivationProvider: ITerminalActivationCommandProvider;
    let pyenvActivationProvider: ITerminalActivationCommandProvider;
    let pipenvActivationProvider: ITerminalActivationCommandProvider;
    let pythonSettings: PythonSettings;
    let shellDetectorIdentifyTerminalShell: sinon.SinonStub<[(Terminal | undefined)?], TerminalShellType>;
    let mockDetector: IShellDetector;
    const pythonInterpreter: PythonInterpreter = {
        path: '/foo/bar/python.exe',
        version: new SemVer('3.6.6-final'),
        sysVersion: '1.0.0.0',
        sysPrefix: 'Python',
        type: InterpreterType.Unknown,
        architecture: Architecture.x64
    };

    function doSetup() {
        mockDetector = mock(TerminalNameShellDetector);
        terminalManager = mock(TerminalManager);
        platformService = mock(PlatformService);
        condaService = mock(CondaService);
        configurationService = mock(ConfigurationService);
        condaActivationProvider = mock(CondaActivationCommandProvider);
        bashActivationProvider = mock(Bash);
        cmdActivationProvider = mock(CommandPromptAndPowerShell);
        pyenvActivationProvider = mock(PyEnvActivationCommandProvider);
        pipenvActivationProvider = mock(PipEnvActivationCommandProvider);
        pythonSettings = mock(PythonSettings);
        shellDetectorIdentifyTerminalShell = sinon.stub(ShellDetector.prototype, 'identifyTerminalShell');
        helper = new TerminalHelper(instance(platformService), instance(terminalManager),
            instance(condaService),
            instance(mock(InterpreterService)),
            instance(configurationService),
            instance(condaActivationProvider),
            instance(bashActivationProvider),
            instance(cmdActivationProvider),
            instance(pyenvActivationProvider),
            instance(pipenvActivationProvider),
            [instance(mockDetector)]);
    }
    teardown(() => shellDetectorIdentifyTerminalShell.restore());
    suite('Misc', () => {
        setup(doSetup);

        test('Create terminal without a title', () => {
            const terminal = 'Terminal Created';
            when(terminalManager.createTerminal(anything())).thenReturn(terminal as any);

            const term = helper.createTerminal();

            verify(terminalManager.createTerminal(anything())).once();
            const args = capture(terminalManager.createTerminal).first()[0];
            expect(term).to.be.deep.equal(terminal);
            expect(args.name).to.be.deep.equal(undefined, 'name should be undefined');
        });
        test('Create terminal with a title', () => {
            const theTitle = 'Hello';
            const terminal = 'Terminal Created';
            when(terminalManager.createTerminal(anything())).thenReturn(terminal as any);

            const term = helper.createTerminal(theTitle);

            verify(terminalManager.createTerminal(anything())).once();
            const args = capture(terminalManager.createTerminal).first()[0];
            expect(term).to.be.deep.equal(terminal);
            expect(args.name).to.be.deep.equal(theTitle);
        });
        test('Ensure spaces in command is quoted', async () => {
            getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(item => {
                const command = 'c:\\python 3.7.exe';
                const args = ['1', '2'];
                const commandPrefix = (item.value === TerminalShellType.powershell || item.value === TerminalShellType.powershellCore) ? '& ' : '';
                const expectedTerminalCommand = `${commandPrefix}${command.fileToCommandArgument()} 1 2`;

                const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
                expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell ${item.name}`);
            });
        });

        test('Ensure empty args are ignored', async () => {
            getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(item => {
                const command = 'python3.7.exe';
                const args: string[] = [];
                const commandPrefix = (item.value === TerminalShellType.powershell || item.value === TerminalShellType.powershellCore) ? '& ' : '';
                const expectedTerminalCommand = `${commandPrefix}${command}`;

                const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
                expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell '${item.name}'`);
            });
        });

        test('Ensure empty args are ignored with s in command', async () => {
            getNamesAndValues<TerminalShellType>(TerminalShellType).forEach(item => {
                const command = 'c:\\python 3.7.exe';
                const args: string[] = [];
                const commandPrefix = (item.value === TerminalShellType.powershell || item.value === TerminalShellType.powershellCore) ? '& ' : '';
                const expectedTerminalCommand = `${commandPrefix}${command.fileToCommandArgument()}`;

                const terminalCommand = helper.buildCommandForTerminal(item.value, command, args);
                expect(terminalCommand).to.equal(expectedTerminalCommand, `Incorrect command for Shell ${item.name}`);
            });
        });
    });


    function title(resource?: Uri, interpreter?: PythonInterpreter) {
        return `${resource ? 'With a resource' : 'Without a resource'}${interpreter ? ' and an interpreter' : ''}`;
    }

    suite('Activation', () => {
        [undefined, Uri.parse('a')].forEach(resource => {
            suite(title(resource), () => {
                setup(() => {
                    doSetup();
                    when(configurationService.getSettings(resource)).thenReturn(instance(pythonSettings));
                });
                test('Activation command must be empty if activation of terminals is disabled', async () => {
                    when(pythonSettings.terminal).thenReturn({ activateEnvironment: false } as any);

                    const cmd = await helper.getEnvironmentActivationCommands(anything(), resource);

                    expect(cmd).to.equal(undefined, 'Command must be undefined');
                    verify(pythonSettings.terminal).once();
                });
                function ensureCondaIsSupported(isSupported: boolean, pythonPath: string, condaActivationCommands: string[]) {
                    when(pythonSettings.pythonPath).thenReturn(pythonPath);
                    when(pythonSettings.terminal).thenReturn({ activateEnvironment: true } as any);
                    when(condaService.isCondaEnvironment(pythonPath)).thenResolve(isSupported);
                    when(condaActivationProvider.getActivationCommands(resource, anything())).thenResolve(condaActivationCommands);
                }
                test('Activation command must return conda activation command if interpreter is conda', async () => {
                    const pythonPath = 'some python Path value';
                    const condaActivationCommands = ['Hello', '1'];
                    ensureCondaIsSupported(true, pythonPath, condaActivationCommands);

                    const cmd = await helper.getEnvironmentActivationCommands(anything(), resource);

                    expect(cmd).to.equal(condaActivationCommands);
                    verify(pythonSettings.terminal).once();
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.isCondaEnvironment(pythonPath)).once();
                    verify(condaActivationProvider.getActivationCommands(resource, anything())).once();
                });
                test('Activation command must return undefined if none of the proivders support the shell', async () => {
                    const pythonPath = 'some python Path value';
                    ensureCondaIsSupported(false, pythonPath, []);

                    when(bashActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(cmdActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(pyenvActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(pipenvActivationProvider.isShellSupported(anything())).thenReturn(false);

                    const cmd = await helper.getEnvironmentActivationCommands('someShell' as any as TerminalShellType, resource);

                    expect(cmd).to.equal(undefined, 'Command must be undefined');
                    verify(pythonSettings.terminal).once();
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.isCondaEnvironment(pythonPath)).once();
                    verify(bashActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pyenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pipenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(cmdActivationProvider.isShellSupported(anything())).atLeast(1);
                });
                test('Activation command must return command from bash if that is supported and others are not', async () => {
                    const pythonPath = 'some python Path value';
                    const expectCommand = ['one', 'two'];
                    ensureCondaIsSupported(false, pythonPath, []);

                    when(bashActivationProvider.getActivationCommands(resource, anything())).thenResolve(expectCommand);

                    when(bashActivationProvider.isShellSupported(anything())).thenReturn(true);
                    when(cmdActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(pyenvActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(pipenvActivationProvider.isShellSupported(anything())).thenReturn(false);

                    const cmd = await helper.getEnvironmentActivationCommands(anything(), resource);

                    expect(cmd).to.deep.equal(expectCommand);
                    verify(pythonSettings.terminal).once();
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.isCondaEnvironment(pythonPath)).once();
                    verify(bashActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(bashActivationProvider.getActivationCommands(resource, anything())).once();
                    verify(pyenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pipenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(cmdActivationProvider.isShellSupported(anything())).atLeast(1);
                });
                test('Activation command must return command from pipenv if that is supported and even if others are supported', async () => {
                    const pythonPath = 'some python Path value';
                    const expectCommand = ['one', 'two'];
                    ensureCondaIsSupported(false, pythonPath, []);

                    when(pipenvActivationProvider.getActivationCommands(resource, anything())).thenResolve(expectCommand);
                    when(pipenvActivationProvider.isShellSupported(anything())).thenReturn(true);

                    [bashActivationProvider, cmdActivationProvider, pyenvActivationProvider].forEach(provider => {
                        when(provider.getActivationCommands(resource, anything())).thenResolve(['Something']);
                        when(provider.isShellSupported(anything())).thenReturn(true);
                    });

                    const cmd = await helper.getEnvironmentActivationCommands(anything(), resource);

                    expect(cmd).to.deep.equal(expectCommand);
                    verify(pythonSettings.terminal).once();
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.isCondaEnvironment(pythonPath)).once();
                    verify(bashActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(bashActivationProvider.getActivationCommands(resource, anything())).never();
                    verify(pyenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pipenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pipenvActivationProvider.getActivationCommands(resource, anything())).atLeast(1);
                    verify(cmdActivationProvider.isShellSupported(anything())).atLeast(1);
                });
                test('Activation command must return command from Command Prompt if that is supported and others are not', async () => {
                    const pythonPath = 'some python Path value';
                    const expectCommand = ['one', 'two'];
                    ensureCondaIsSupported(false, pythonPath, []);

                    when(cmdActivationProvider.getActivationCommands(resource, anything())).thenResolve(expectCommand);

                    when(bashActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(cmdActivationProvider.isShellSupported(anything())).thenReturn(true);
                    when(pyenvActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(pipenvActivationProvider.isShellSupported(anything())).thenReturn(false);

                    const cmd = await helper.getEnvironmentActivationCommands(anything(), resource);

                    expect(cmd).to.deep.equal(expectCommand);
                    verify(pythonSettings.terminal).once();
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.isCondaEnvironment(pythonPath)).once();
                    verify(bashActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(cmdActivationProvider.getActivationCommands(resource, anything())).once();
                    verify(pyenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pipenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(cmdActivationProvider.isShellSupported(anything())).atLeast(1);
                });
                test('Activation command must return command from Command Prompt if that is supported, and so is bash but no commands are returned', async () => {
                    const pythonPath = 'some python Path value';
                    const expectCommand = ['one', 'two'];
                    ensureCondaIsSupported(false, pythonPath, []);

                    when(cmdActivationProvider.getActivationCommands(resource, anything())).thenResolve(expectCommand);
                    when(bashActivationProvider.getActivationCommands(resource, anything())).thenResolve([]);

                    when(bashActivationProvider.isShellSupported(anything())).thenReturn(true);
                    when(cmdActivationProvider.isShellSupported(anything())).thenReturn(true);
                    when(pyenvActivationProvider.isShellSupported(anything())).thenReturn(false);
                    when(pipenvActivationProvider.isShellSupported(anything())).thenReturn(false);

                    const cmd = await helper.getEnvironmentActivationCommands(anything(), resource);

                    expect(cmd).to.deep.equal(expectCommand);
                    verify(pythonSettings.terminal).once();
                    verify(pythonSettings.pythonPath).once();
                    verify(condaService.isCondaEnvironment(pythonPath)).once();
                    verify(bashActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(bashActivationProvider.getActivationCommands(resource, anything())).once();
                    verify(cmdActivationProvider.getActivationCommands(resource, anything())).once();
                    verify(pyenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(pipenvActivationProvider.isShellSupported(anything())).atLeast(1);
                    verify(cmdActivationProvider.isShellSupported(anything())).atLeast(1);
                });
                [undefined, pythonInterpreter].forEach(interpreter => {
                    test('Activation command for Shell must be empty for unknown os', async () => {
                        when(platformService.osType).thenReturn(OSType.Unknown);

                        for (const item of getNamesAndValues<TerminalShellType>(TerminalShellType)) {
                            const cmd = await helper.getEnvironmentActivationShellCommands(resource, item.value, interpreter);
                            expect(cmd).to.equal(undefined, 'Command must be undefined');
                        }
                    });
                });
                [undefined, pythonInterpreter].forEach(interpreter => {
                    [OSType.Linux, OSType.OSX, OSType.Windows].forEach(osType => {
                        test(`Activation command for Shell must never use pipenv nor pyenv (${osType})`, async () => {
                            const pythonPath = 'some python Path value';
                            const shellToExpect = osType === OSType.Windows ? TerminalShellType.commandPrompt : TerminalShellType.bash;
                            ensureCondaIsSupported(false, pythonPath, []);

                            shellDetectorIdentifyTerminalShell.returns(shellToExpect);
                            when(platformService.osType).thenReturn(osType);
                            when(bashActivationProvider.isShellSupported(shellToExpect)).thenReturn(false);
                            when(cmdActivationProvider.isShellSupported(shellToExpect)).thenReturn(false);

                            const cmd = await helper.getEnvironmentActivationShellCommands(resource, shellToExpect, interpreter);

                            expect(cmd).to.equal(undefined, 'Command must be undefined');
                            verify(pythonSettings.terminal).once();
                            verify(pythonSettings.pythonPath).once();
                            verify(condaService.isCondaEnvironment(pythonPath)).once();
                            verify(bashActivationProvider.isShellSupported(shellToExpect)).atLeast(1);
                            verify(pyenvActivationProvider.isShellSupported(anything())).never();
                            verify(pipenvActivationProvider.isShellSupported(anything())).never();
                            verify(cmdActivationProvider.isShellSupported(shellToExpect)).atLeast(1);
                        });
                    });
                });
            });
        });
    });

    suite('Identify Terminal Shell', () => {
        setup(doSetup);
        test('Use shell detector to identify terminal shells', () => {
            const terminal = {} as any;
            const expectedShell = TerminalShellType.ksh;
            shellDetectorIdentifyTerminalShell.returns(expectedShell);

            const shell = helper.identifyTerminalShell(terminal);
            expect(shell).to.be.equal(expectedShell);
            expect(shellDetectorIdentifyTerminalShell.callCount).to.equal(1);
            expect(shellDetectorIdentifyTerminalShell.args[0]).deep.equal([terminal]);
        });
        test('Detector passed throught constructor is used by shell detector class', () => {
            const terminal = {} as any;
            const expectedShell = TerminalShellType.ksh;
            shellDetectorIdentifyTerminalShell.callThrough();
            when(mockDetector.identify(anything(), terminal)).thenReturn(expectedShell);

            const shell = helper.identifyTerminalShell(terminal);

            expect(shell).to.be.equal(expectedShell);
            expect(shellDetectorIdentifyTerminalShell.callCount).to.equal(1);
            verify(mockDetector.identify(anything(), terminal)).once();
        });
    });
});
