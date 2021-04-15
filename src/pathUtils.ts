import { URI } from "vscode-uri";

export const convertUriToPath = (uri: string) => {
  return URI.parse(uri).fsPath;
};
