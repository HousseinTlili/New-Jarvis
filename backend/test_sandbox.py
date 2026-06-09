import os
import sys

# Add backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from tools.python_sandbox import run_python_code, PythonSandboxManager

def run_sandbox_tests():
    print("--- Starting Stateful Python Sandbox E2E Test ---")
    
    # Reset instance
    sandbox = PythonSandboxManager.get_instance()
    sandbox.start_worker()
    
    # 1. Test Stateful Execution
    print("\n[Test 1] Stateful Variable Persistence")
    run_python_code("my_test_var = 12345\nprint('Defined my_test_var.')")
    
    result = run_python_code("print(f'Retrieved value: {my_test_var}')")
    print(result)
    if "Retrieved value: 12345" in result:
        print("[OK] Stateful variable persistence verified!")
    else:
        print("[FAIL] Stateful variable persistence failed.")
        
    # 2. Test Execution Timeout & Recovery
    print("\n[Test 2] Execution Timeout Recovery")
    print("Running infinite loop code (should timeout in 15 seconds)...")
    loop_result = run_python_code("import time\nwhile True:\n    time.sleep(0.5)")
    print(loop_result)
    
    if "Execution Timed Out" in loop_result:
        print("[OK] Execution timeout intercepted successfully!")
    else:
        print("[FAIL] Infinite loop was not timed out.")
        
    print("Checking if sandbox worker recovered...")
    recovery_result = run_python_code("print('Sandbox is alive!')")
    print(recovery_result)
    if "Sandbox is alive!" in recovery_result:
        print("[OK] Sandbox worker recovered and is running code statefully!")
    else:
        print("[FAIL] Sandbox worker failed to recover after timeout.")
        
    # 3. Test Headless Matplotlib Plotting
    print("\n[Test 3] Headless Matplotlib Plotting")
    plot_file = os.path.join(sandbox.plots_dir, "test_sinewave.png")
    if os.path.exists(plot_file):
        os.remove(plot_file)
        
    plot_code = (
        "import numpy as np\n"
        "import matplotlib.pyplot as plt\n"
        "x = np.linspace(0, 10, 100)\n"
        "y = np.sin(x)\n"
        "plt.plot(x, y)\n"
        "plt.title('Test Wave')\n"
        f"plt.savefig(r'{plot_file}')\n"
        "plt.close()\n"
        "print('Plot saved successfully.')"
    )
    plot_result = run_python_code(plot_code)
    print(plot_result)
    
    if os.path.exists(plot_file) and os.path.getsize(plot_file) > 0:
        print(f"[OK] Headless plot verified! Saved to {plot_file}")
        # Clean up
        os.remove(plot_file)
    else:
        print("[FAIL] Headless plot was not created or is empty.")
        
    # 4. Test Auto-Pip Dependency Installation
    print("\n[Test 4] Auto-Pip Dependency Installation")
    # We attempt to import "cowsay" which is not pre-installed in the virtual environment.
    # The sandbox manager should intercept the error, run pip install cowsay, and retry.
    cowsay_code = (
        "import cowsay\n"
        "print(cowsay.get_output_string('cow', 'Hello Sandbox!'))"
    )
    print("Running cowsay import (should trigger pip install)...")
    cowsay_result = run_python_code(cowsay_code)
    print(cowsay_result)
    
    if "Hello Sandbox!" in cowsay_result and "cowsay" in cowsay_result:
        print("[OK] Auto-pip installation and execution retry verified!")
    else:
        print("[FAIL] Auto-pip installation failed.")
        
    print("\n--- Sandbox E2E Test Completed ---")

if __name__ == "__main__":
    run_sandbox_tests()
