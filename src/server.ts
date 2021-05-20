import { spawnSync } from "child_process";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  ConfigurationItem,
  Connection,
  createConnection,
  InitializeResult,
  TextDocuments,
  TextDocumentSyncKind,
  WorkspaceFolder,
} from "vscode-languageserver/node";
import { createDeferred, Deferred } from "./deferred";
import { findBinary } from "./mypy";
import { parseOutput } from "./parser";
import { convertUriToPath } from "./pathUtils";
import { spawnAsync } from "./process";
import { isNumber } from "./typeUtils";
import { WorkspaceMap } from "./workspaceMap";

interface ServerSettings {
  daemonTimeout: number;
}

interface ClientCapabilities {
  hasConfigurationCapability: boolean;
  hasWorkspaceFolderCapability: boolean;
}

export interface WorkspaceServiceInstance {
  rootPath: string;
  rootUri: string;
  binaryPath: string;
  isInitialized: Deferred<boolean>;
}

export class Server {
  connection: Connection = createConnection();
  workspaceMap: WorkspaceMap = new WorkspaceMap();

  client: ClientCapabilities = {
    hasConfigurationCapability: false,
    hasWorkspaceFolderCapability: false,
  };

  documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

  readonly console;

  constructor() {
    this.console = this.connection.console;
    this.setupConnection();
    this.start();
  }

  start() {
    this.documents.listen(this.connection);
    this.connection.listen();
  }

  setupConnection() {
    const connection = this.connection;
    const documents = this.documents;

    connection.onInitialize((params) => {
      const capabilities = params.capabilities;

      this.client.hasConfigurationCapability = !!capabilities.workspace
        ?.configuration;
      this.client.hasWorkspaceFolderCapability = !!capabilities.workspace
        ?.workspaceFolders;

      // Create a service instance for each of the workspace folders.
      if (params.workspaceFolders) {
        params.workspaceFolders.forEach((workspace) => {
          const rootPath = convertUriToPath(workspace.uri);
          const newWorkspace = this.createWorkspaceServiceInstance(
            workspace,
            rootPath
          );
          this.workspaceMap.set(rootPath, newWorkspace);
        });

        this.updateSettingsForAllWorkspaces();
      }

      const result: InitializeResult = {
        capabilities: {
          textDocumentSync: {
            openClose: true,
            change: TextDocumentSyncKind.None,
            save: {
              includeText: false,
            },
          },
          workspace: {
            workspaceFolders: {
              supported: true,
            },
          },
        },
      };

      return result;
    });

    connection.onInitialized(() => {
      if (this.client.hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((event) => {
          event.removed.forEach((workspace) => {
            const rootPath = convertUriToPath(workspace.uri);
            const oldWorkspace = this.workspaceMap.get(rootPath);
            if (oldWorkspace) {
              this.stop(oldWorkspace);
            }
            this.workspaceMap.delete(rootPath);
          });

          event.added.forEach(async (workspace) => {
            const rootPath = convertUriToPath(workspace.uri);
            const newWorkspace = this.createWorkspaceServiceInstance(
              workspace,
              rootPath
            );
            this.workspaceMap.set(rootPath, newWorkspace);
            await this.updateSettingsForWorkspace(newWorkspace);
          });
        });
      }
    });

    connection.onDidChangeConfiguration((_params) => {
      this.updateSettingsForAllWorkspaces();
    });

    documents.onDidOpen(({ document }) => {
      this.validateTextDocument(document.uri);
    });

    documents.onDidSave(({ document }) => {
      this.validateTextDocument(document.uri);
    });

    connection.onShutdown(() => {
      this.workspaceMap.forEach((workspace) => {
        this.stop(workspace);
      });
    });
  }

  stop(workspace: WorkspaceServiceInstance) {
    spawnSync(workspace.binaryPath, ["stop"], { cwd: workspace.rootPath });
  }

  async getSettings(
    workspace: WorkspaceServiceInstance
  ): Promise<ServerSettings> {
    const serverSettings: ServerSettings = { daemonTimeout: 900 };

    try {
      const mypySection = await this.getConfiguration(
        workspace.rootUri,
        "mypy"
      );
      if (mypySection) {
        const daemonTimeout = mypySection.daemonTimeout;
        if (daemonTimeout !== undefined && isNumber(daemonTimeout)) {
          serverSettings.daemonTimeout = daemonTimeout;
        }
      }
    } catch (error) {
      this.console.error(`Error reading settings: ${error}`);
    }

    return serverSettings;
  }

  async getWorkspaceForFile(
    filePath: string
  ): Promise<WorkspaceServiceInstance> {
    const workspace = this.workspaceMap.getWorkspaceForFile(filePath);
    await workspace.isInitialized.promise;
    return workspace;
  }

  createWorkspaceServiceInstance(
    workspace: WorkspaceFolder,
    rootPath: string
  ): WorkspaceServiceInstance {
    const binaryPath = findBinary(convertUriToPath(workspace.uri));
    const rootUri = workspace.uri;
    const isInitialized = createDeferred<boolean>();

    return {
      binaryPath,
      rootPath,
      rootUri,
      isInitialized,
    };
  }

  async getConfiguration(scopeUri: string | undefined, section: string) {
    if (this.client.hasConfigurationCapability) {
      const item: ConfigurationItem = {
        scopeUri,
        section,
      };
      return this.connection.workspace.getConfiguration(item);
    }

    return undefined;
  }

  async updateSettingsForWorkspace(
    workspace: WorkspaceServiceInstance
  ): Promise<void> {
    const serverSettings = await this.getSettings(workspace);
    spawnSync(workspace.binaryPath, [
      "start",
      "--timeout",
      serverSettings.daemonTimeout.toString(),
    ]);
    workspace.isInitialized.resolve(true);
    this.console.info(
      `mypy-ls isInitialized for workspace "${workspace.rootPath}"`
    );
  }

  updateSettingsForAllWorkspaces(): void {
    this.workspaceMap.forEach((workspace) => {
      this.updateSettingsForWorkspace(workspace).catch(() => {}); // Ignore errors.
    });
  }

  async validateTextDocument(documentUri: string) {
    const filePath = convertUriToPath(documentUri);
    const workspace = await this.getWorkspaceForFile(filePath);
    const settings = await this.getSettings(workspace);

    const cmd = await spawnAsync(
      workspace.binaryPath,
      [
        "run",
        "--timeout",
        settings.daemonTimeout.toString(),
        "--",
        "--no-pretty",
        "--no-color-output",
        "--no-error-summary",
        "--show-column-numbers",
        "--show-error-codes",
        "--hide-error-context",
        filePath,
      ],
      {
        cwd: workspace.rootPath,
      }
    );

    const diagnostics = parseOutput(cmd.stdout);

    this.connection.sendDiagnostics({ uri: documentUri, diagnostics });
  }
}
