import { CommandableDeclarable } from "#/declarations/Commandable";
import { CommandDeclarationParsable, CommandDeclarationParser } from "#/declarations/CommandDeclarationParser";
import { Commands } from "#/declarations/CommandNames";
import { AlternateHeadingsParser } from "#/declarations/commands/AlternateHeadings";
import { HeadingAndDelimiterParser } from "#/declarations/commands/HeadingAndDelimiter";
import { HeadingIsFrontParser } from "#/declarations/commands/HeadingIsFront";
import { TablesDeclarationParser } from "#/declarations/commands/Tables";

const REGISTRY = [
	CommandDeclarationParser.Factory.createEntry(Commands.Name.AlternateHeadings, AlternateHeadingsParser),
	CommandDeclarationParser.Factory.createEntry(Commands.Name.HeadingAndDelimiter, HeadingAndDelimiterParser),
	CommandDeclarationParser.Factory.createEntry(Commands.Name.HeadingIsFront, HeadingIsFrontParser),
	CommandDeclarationParser.Factory.createEntry(Commands.Name.Table, TablesDeclarationParser),
];

export const ParserRegistry = {
	tryCreate(commandable: CommandableDeclarable): CommandDeclarationParsable | null {
		const parsable = REGISTRY.find(e => e.names.includes(commandable.name));
		return parsable !== undefined ? parsable.create(commandable) : null;
	}
};
