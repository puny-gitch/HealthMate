from app.services.knowledge_index import KnowledgeIndexService


def main() -> None:
    result = KnowledgeIndexService().index_markdown_knowledge()
    print(result)


if __name__ == "__main__":
    main()
