/*!
 * Readur Test Runner
 * 
 * A Rust-based test orchestrator that runs different types of tests
 * and provides a unified interface for the entire test suite.
 */

use std::process::{Command, Stdio};
use std::io::{self, Write};
use std::env;

#[derive(Debug, Clone)]
enum TestType {
    Unit,
    Integration,
    Frontend,
    All,
}

#[derive(Debug)]
struct TestResult {
    test_type: String,
    success: bool,
    output: String,
    duration: std::time::Duration,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    
    let test_type = match args.get(1).map(|s| s.as_str()) {
        Some("unit") => TestType::Unit,
        Some("integration") => TestType::Integration,
        Some("frontend") => TestType::Frontend,
        Some("all") | None => TestType::All,
        Some(other) => {
            eprintln!("Unknown test type: {}", other);
            print_help();
            std::process::exit(1);
        }
    };
    
    println!("🧪 Readur Test Runner");
    println!("====================");
    
    let mut results = Vec::new();
    
    match test_type {
        TestType::Unit => {
            results.push(run_unit_tests()?);
        }
        TestType::Integration => {
            check_server_running()?;
            results.push(run_integration_tests()?);
        }
        TestType::Frontend => {
            results.push(run_frontend_tests()?);
        }
        TestType::All => {
            results.push(run_unit_tests()?);
            results.push(run_frontend_tests()?);
            
            // Only run integration tests if server is running
            if check_server_running().is_ok() {
                results.push(run_integration_tests()?);
            } else {
                println!("⚠️  Skipping integration tests (server not running)");
                println!("   Start server with: cargo run");
            }
        }
    }
    
    print_summary(&results);
    
    // Exit with error code if any tests failed
    if results.iter().any(|r| !r.success) {
        std::process::exit(1);
    }
    
    Ok(())
}

fn run_unit_tests() -> Result<TestResult, Box<dyn std::error::Error>> {
    println!("\n🔬 Running Unit Tests");
    println!("--------------------");
    
    let start = std::time::Instant::now();
    
    let output = Command::new("cargo")
        .args(&["test", "--test", "unit_tests", "--", "--nocapture"])
        .output()?;
    
    let duration = start.elapsed();
    let success = output.status.success();
    let output_str = String::from_utf8_lossy(&output.stdout).to_string();
    
    if success {
        println!("✅ Unit tests passed ({:.2}s)", duration.as_secs_f64());
    } else {
        println!("❌ Unit tests failed");
        println!("{}", String::from_utf8_lossy(&output.stderr));
    }
    
    Ok(TestResult {
        test_type: "Unit Tests".to_string(),
        success,
        output: output_str,
        duration,
    })
}

fn run_integration_tests() -> Result<TestResult, Box<dyn std::error::Error>> {
    println!("\n🌐 Running Integration Tests");
    println!("---------------------------");
    
    let start = std::time::Instant::now();
    
    let output = Command::new("cargo")
        .args(&["test", "--test", "integration_tests", "--", "--nocapture"])
        .output()?;
    
    let duration = start.elapsed();
    let success = output.status.success();
    let output_str = String::from_utf8_lossy(&output.stdout).to_string();
    
    if success {
        println!("✅ Integration tests passed ({:.2}s)", duration.as_secs_f64());
    } else {
        println!("❌ Integration tests failed");
        println!("{}", String::from_utf8_lossy(&output.stderr));
    }
    
    Ok(TestResult {
        test_type: "Integration Tests".to_string(),
        success,
        output: output_str,
        duration,
    })
}

fn run_frontend_tests() -> Result<TestResult, Box<dyn std::error::Error>> {
    println!("\n🎨 Running Frontend Tests");
    println!("-------------------------");
    
    let start = std::time::Instant::now();
    
    let output = Command::new("npm")
        .args(&["test", "--", "--run"])
        .current_dir("frontend")
        .output()?;
    
    let duration = start.elapsed();
    let success = output.status.success();
    let output_str = String::from_utf8_lossy(&output.stdout).to_string();
    
    if success {
        println!("✅ Frontend tests passed ({:.2}s)", duration.as_secs_f64());
    } else {
        println!("❌ Frontend tests failed");
        println!("{}", String::from_utf8_lossy(&output.stderr));
    }
    
    Ok(TestResult {
        test_type: "Frontend Tests".to_string(),
        success,
        output: output_str,
        duration,
    })
}

fn check_server_running() -> Result<(), Box<dyn std::error::Error>> {
    let output = Command::new("curl")
        .args(&["-s", "-f", "http://localhost:8080/api/health"])
        .output()?;
    
    if output.status.success() {
        let response = String::from_utf8_lossy(&output.stdout);
        if response.contains("\"status\":\"ok\"") {
            return Ok(());
        }
    }
    
    Err("Server not running or not healthy at http://localhost:8080".into())
}

fn print_summary(results: &[TestResult]) {
    println!("\n📊 Test Summary");
    println!("===============");
    
    let total_duration: std::time::Duration = results.iter().map(|r| r.duration).sum();
    let passed = results.iter().filter(|r| r.success).count();
    let total = results.len();
    
    for result in results {
        let status = if result.success { "✅" } else { "❌" };
        println!("{} {} ({:.2}s)", status, result.test_type, result.duration.as_secs_f64());
    }
    
    println!("\nTotal: {}/{} passed in {:.2}s", passed, total, total_duration.as_secs_f64());
    
    if passed == total {
        println!("🎉 All tests passed!");
    } else {
        println!("💥 Some tests failed!");
    }
}

fn print_help() {
    println!("Usage: cargo run --bin test_runner [TEST_TYPE]");
    println!();
    println!("Test Types:");
    println!("  unit         Run unit tests only (fast, no dependencies)");
    println!("  integration  Run integration tests (requires running server)");
    println!("  frontend     Run frontend tests");
    println!("  all          Run all tests (default)");
    println!();
    println!("Examples:");
    println!("  cargo run --bin test_runner unit");
    println!("  cargo run --bin test_runner integration");
    println!("  cargo run --bin test_runner all");
}