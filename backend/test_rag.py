import os
import sys
import shutil
import time

# Add backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db
from recall.rag_manager import index_folder, search_indexed_files

def run_rag_test():
    print("--- Starting Local Vector RAG E2E Test ---")
    
    # 1. Initialize DB to make sure schemas are up-to-date
    print("Initializing Database...")
    init_db()
    
    # 2. Create a temporary testing directory
    test_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_rag_workspace")
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
    os.makedirs(test_dir)
    
    # 3. Create test files with distinct semantic content
    file_a = os.path.join(test_dir, "quantum_physics.txt")
    with open(file_a, "w", encoding="utf-8") as f:
        f.write(
            "Quantum entanglement is a physical phenomenon that occurs when a pair or group of particles "
            "are generated, interact, or share spatial proximity in a way such that the quantum state of "
            "each particle of the pair or group cannot be described independently of the state of the others, "
            "even when the particles are separated by a large distance. Erwin Schrödinger coined the term."
        )
        
    file_b = os.path.join(test_dir, "cooking_recipe.txt")
    with open(file_b, "w", encoding="utf-8") as f:
        f.write(
            "To make the perfect chocolate chip cookie, you need to cream the softened butter together with "
            "both granulated white sugar and brown sugar. Then, beat in the eggs one at a time, followed by "
            "pure vanilla extract. Gradually mix in the flour, baking soda, and salt before folding in chocolate chips."
        )

    print(f"Created test files in: {test_dir}")
    
    try:
        # 4. Trigger indexing
        print("Indexing test directory...")
        index_folder(test_dir)
        print("Indexing completed successfully.")
        
        # 5. Search for a query related to physics
        physics_query = "What did Erwin Schrödinger write about entangled particles?"
        print(f"\nSearching for query: '{physics_query}'")
        physics_results = search_indexed_files(physics_query, limit=2)
        
        print(f"Found {len(physics_results)} results:")
        for r in physics_results:
            print(f" - Path: {os.path.basename(r['path'])} | Similarity: {r['similarity']:.4f}")
            print(f"   Content: {r['content'][:150]}...")
            
        # Verify physics matches quantum physics file
        if physics_results and "quantum_physics.txt" in physics_results[0]["path"]:
            print("[OK] Success: Physics query matched quantum_physics.txt first!")
        else:
            print("[FAIL] Failure: Physics query did not match quantum_physics.txt first.")
            
        # 6. Search for a query related to cookies
        cookie_query = "How do you mix butter and flour to bake sweet chocolate snacks?"
        print(f"\nSearching for query: '{cookie_query}'")
        cookie_results = search_indexed_files(cookie_query, limit=2)
        
        print(f"Found {len(cookie_results)} results:")
        for r in cookie_results:
            print(f" - Path: {os.path.basename(r['path'])} | Similarity: {r['similarity']:.4f}")
            print(f"   Content: {r['content'][:150]}...")
            
        # Verify cookie query matches recipe file
        if cookie_results and "cooking_recipe.txt" in cookie_results[0]["path"]:
            print("[OK] Success: Cooking query matched cooking_recipe.txt first!")
        else:
            print("[FAIL] Failure: Cooking query did not match cooking_recipe.txt first.")
            
    finally:
        # Cleanup test workspace
        print("\nCleaning up test directory...")
        shutil.rmtree(test_dir)
        print("Test completed.")

if __name__ == "__main__":
    run_rag_test()
