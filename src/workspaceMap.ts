import { WorkspaceServiceInstance } from "./server";

export class WorkspaceMap extends Map<string, WorkspaceServiceInstance> {
  getWorkspaceForFile(filePath: string): WorkspaceServiceInstance {
    let bestInstance: WorkspaceServiceInstance | undefined;

    // This selectes the most specific workspace folder.
    this.forEach((workspace) => {
      if (filePath.startsWith(workspace.rootPath)) {
        if (
          bestInstance === undefined ||
          workspace.rootPath.startsWith(bestInstance.rootPath)
        ) {
          bestInstance = workspace;
        }
      }
    });

    // TODO: Handle bestInstance === undefined
    if (bestInstance === undefined) {
      throw Error(
        `Unable to find workspace for "${filePath}" in ${JSON.stringify(this)}`
      );
    }

    return bestInstance;
  }
}
