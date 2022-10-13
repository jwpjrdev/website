import { unified } from "unified/lib/index.js";
import { readFile } from "fs/promises";
import { Octokit } from "octokit";
import { paginateGraphql } from "@octokit/plugin-paginate-graphql";
import minimist from "minimist";
import remarkParse from "remark-parse";
import metadataParser from "markdown-yaml-metadata-parser";

import { getPrsForRepo } from "./getPrs.js";
import { changelogPath, lineBreak } from "./config.js";
import { sayHello } from "./cli.js";

const argv = minimist(process.argv.slice(2));

export const createOctokitClient = async (/** @type {string} */ token) => {
  const OctokitWithPlugins = Octokit.plugin(paginateGraphql);
  const octokit = new OctokitWithPlugins({
    auth: token,
  });
  await sayHello(octokit);

  return octokit;
};

export const getPrParticipants = (pr) => {
  const author = pr.author?.login;
  const participants = pr.participants.nodes
    .map(({ login }) => login)
    .filter((login) => !["roboquat", author].includes(login))
    .sort();
  return [author, ...participants].join(",");
};

export const parseOldReleaseNote = (pr) => {
  const releaseNoteMatch = pr.body.match(/```release-notes?(.+?)```/s);
  const releaseNoteText = releaseNoteMatch && releaseNoteMatch[1].trim();
  if (!releaseNoteMatch || releaseNoteText.toUpperCase() === "NONE")
    return null;
  return releaseNoteText;
};

/**
 * Parser for the new release note format (delimited by headings)
 */
export const parseNewReleaseNote = (pr) => {
  const data = unified().use(remarkParse).parse(pr.body);
  const blockName = "Release Notes";
  const releaseNotesStart = data.children.find(
    (node) =>
      node.type === "heading" &&
      node.depth === 2 &&
      node.children[0].value.toLowerCase() === blockName.toLowerCase()
  )?.position.end.offset;

  if (!releaseNotesStart) return null;

  const releaseNotesEnd =
    data.children.find(
      (node) =>
        node.type === "heading" &&
        node.depth === 2 &&
        node.position.start.offset > releaseNotesStart
    )?.position.start.offset - 1;

  const releaseNotes = pr.body.slice(
    releaseNotesStart,
    releaseNotesEnd || undefined
  );
  const htmlComments = /<!--([\s\S]*?)-->/g; // https://github.com/stevemao/html-comment-regex/blob/master/index.js
  const withRemovedComments = releaseNotes.replace(htmlComments, "").trim();

  if (!withRemovedComments || withRemovedComments.toUpperCase() === "NONE")
    return null;

  // Make sure the release note isn't the old format
  if (withRemovedComments.startsWith("```release-note")) return null;

  return withRemovedComments;
};

export const parseReleaseNote = (pr) => {
  return parseOldReleaseNote(pr) || parseNewReleaseNote(pr);
};

export const processRepository = async (options) => {
  const { repo, prCategories, octokit, from, to } = options;
  const { prs, forceLabel = false } = await getPrsForRepo(
    octokit,
    repo,
    from,
    to
  );

  if (!prs || prs.length === 0) {
    console.log(`No PRs found for ${repo}`);
    return prCategories;
  }

  prs.filter(parseReleaseNote).forEach((pr) => {
    if (forceLabel) {
      prCategories
        .find((category) => category.partial === forceLabel)
        .prs.push(pr);
      return;
    }

    // We group the PRs by their labels or prefix
    const category = prCategories.find((category) =>
      findCategoryForPr(pr, category)
    );
    if (category) {
      category.prs.push(pr);
    } else {
      prCategories.at(-1).prs.push(pr);
    }
  });
  return prCategories;
};

export const replaceContentOfBlock = (blockName, blockContent, fileContent) => {
  const startingLine = `<!--- BEGIN_${blockName} -->`;
  const endingLine = `<!--- END_${blockName} -->`;

  const startingLineIndex = fileContent.indexOf(startingLine);
  const endingLineIndex = fileContent.indexOf(endingLine);

  if (startingLineIndex === -1 || endingLineIndex === -1) {
    throw new Error(
      `Could not find ${startingLine} and/or ${endingLine} in the changelog file`
    );
  }

  const newContent = [
    fileContent.slice(0, startingLineIndex + startingLine.length),
    blockContent,
    fileContent.slice(endingLineIndex),
  ].join("\r\n");

  return newContent;
};

const prefixRegex = /\[.{1,}\] ?/g;
export const generatePrChangelogLine = (pr) => {
  let releaseNote = parseReleaseNote(pr);
  if (releaseNote.match(prefixRegex)) {
    // Remove the prefix, if any
    releaseNote = releaseNote.replace(prefixRegex, "");
  }
  // Capitalize the first letter
  releaseNote = releaseNote.charAt(0).toUpperCase() + releaseNote.slice(1);

  return `- [#${pr.number}](${
    pr.url
  }) - ${releaseNote} <Contributors usernames="${getPrParticipants(
    pr
  )}" />\r\n`;
};

export const ensureGithubToken = (mockedToken) => {
  let githubToken;

  if (mockedToken === undefined) {
    githubToken = argv.token || process.env.CHANGELOG_GITHUB_ACCESS_TOKEN;
  } else {
    githubToken = mockedToken;
  }

  if (!githubToken) {
    console.error(
      "Please provide a GitHub personal access token via a `CHANGELOG_GITHUB_ACCESS_TOKEN` environment variable."
    );
    console.error(
      "Create a personal access token at https://github.com/settings/tokens/new?scopes=repo,user"
    );
    return null;
  }

  return githubToken;
};

export const findCategoryForPr = (pr, category) => {
  const releaseNote = parseReleaseNote(pr);
  const byLabel = category.labels?.some((label) =>
    pr.labels.nodes?.some((prLabel) => prLabel.name === label)
  );
  const byPrefix =
    category.prefixes?.some(
      (prefix) =>
        releaseNote.startsWith(`[${prefix}]`) ||
        pr.title.startsWith(`[${prefix}]`)
    ) ?? false;

  if (!byLabel && byPrefix) {
    console.warn(
      pr.title,
      "is categorized as",
      category.name,
      "but it doesn't have the label",
      category.labels.join(", ")
    );
  }
  return byLabel || byPrefix;
};

/**
 * Sort by ascending order, according to either the default order value for each category or the order defined in the partial file metadata. If the order is the same, sort by name (alphabetically).
 */
export const sortByCategoryOrder = (a, b) => {
  if (a.order === b.order) {
    return a.name.localeCompare(b.name);
  }
  return a.order - b.order;
};

export const readPartial = async (name, releaseDate) => {
  const partialContent = await readFile(
    `${changelogPath}/${releaseDate}/${name}.md`,
    "utf8"
  ).catch((e) => {
    if (e.code === "ENOENT") {
      return null;
    }
  });

  if (!partialContent) {
    return null;
  }

  const contentWithStrippedMetadata = partialContent.replace(/---.*---/gs, "");
  const contentMetadata = metadataParser(partialContent);
  const order = contentMetadata.metadata?.order;
  return { content: contentWithStrippedMetadata, order };
};

export const formatChangelogCategory = async (prs, category, releaseDate) => {
  const heading = `## ${category.name}${lineBreak}${lineBreak}`;
  const partialContent = await readPartial(category.partial, releaseDate);
  if (partialContent) {
    const { order, content } = partialContent;
    if (partialContent.content) {
      if (prs) {
        // There are PRs in this category, so we prepend the partial content to them
        return {
          order: order,
          content: `${heading}${content}${lineBreak}${lineBreak}${prs}`,
        };
      } else {
        // There are no PRs for this category, so we only include the partial
        return {
          order: order,
          content: `${heading}${content}${lineBreak}${lineBreak}`,
        };
      }
    }
  } else if (prs) {
    return {
      content: `${heading}${prs}${lineBreak}`,
    };
  }
};
