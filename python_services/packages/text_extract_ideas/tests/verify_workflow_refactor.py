"""
Verification script for workflow refactoring.
Checks if pdf_pipeline can be imported and is a compiled graph.
"""
import sys
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent.parent))

try:
    from src.workflow.workflow import pdf_pipeline, create_pdf_pipeline, run_pdf_pipeline
    print("✅ Successfully imported pdf_pipeline")
    print(f"   Graph type: {type(pdf_pipeline)}")
    print(f"   Nodes: {list(pdf_pipeline.nodes.keys())}")
    print()

    # Verify nodes
    from src.workflow.nodes import (
        extract_text,
        detect_structure,
        create_book_node,
        process_section,
        route_sections,
        finalize,
    )
    print("✅ Successfully imported all nodes:")
    print("   - extract_text")
    print("   - detect_structure")
    print("   - create_book_node")
    print("   - process_section")
    print("   - route_sections")
    print("   - finalize")
    print()

    # Verify state
    from src.workflow.state import PipelineState, SectionInfo, create_initial_state
    state = create_initial_state(pdf_path="/test/path.pdf")
    print("✅ Successfully created initial state")
    print(f"   Keys: {list(state.keys())}")
    print(f"   all_sections: {state.get('all_sections')}")
    print(f"   current_section_index: {state.get('current_section_index')}")
    print()

    print("=" * 50)
    print("✅ All verifications passed!")
    print("=" * 50)

except Exception as e:
    print(f"❌ Failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
