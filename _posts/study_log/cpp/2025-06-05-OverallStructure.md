---
title: (C++)1. 기본 구조
thumbnail: https://www.infoworld.com/wp-content/uploads/2024/06/c-plus-plus_code-100790020-orig.jpg?quality=50&strip=all
layout: post
author: jhj
categories:
  - StudyLog
  - Cpp
tags:
  - Programming
  - Language
  - C++
excerpt: c++ 전체 구성요소 및 특징
project_rank: "680"
sticker: emoji//1f4aa
---

### **헤더 파일 추가**

```cpp
#include <headerfile> // library#include "headerfile" // user's header
```

### **표준 라이브러리 주 사용 헤더파일**

```
io, algorithms, containers, concurrency
```

### **자료형**

```
bool, char, int, double
and standard library types such as string, vector<> and so on
```

### **배열, 포인터, 참조자**

```cpp
int arr[5] = { 1,2,3,4,5 };
int* p = arr;
int& r = arr[0];
```

### **주석**

```cpp
// comment text
/*
    Multi-line comment text
*/
```

### **산술 연산자**

```cpp
++, --, +, -, *, /, %
```

### **비트 연산자**

```cpp
&, |, <<, >>, ~, ^
```

### **관계 연산자**

```cpp
<, <=, >, >=, ==, !=
```

### **논리 연산자**

```cpp
||, &&, !
```

### **조건 분기문**

```cpp
if(<conditions>) {
    <statement 1>;
}
else {
    <statement 2>;
}

switch (<expression>)
case <constant 1>:
    <statement sequence 1>;
break;
case <constant 2>:
    <statement sequence 2>;
break;
//...
case <constant n>:
    <statement sequence n>;
break;
default:
    <statement sequence n+1>;
break;
}
```

### **반복문**

```cpp
for(<initialize>; <condition>; <update>)
{ <statement>; }

for ( <range_declaration> : <range_expression> )
{ <statement>; }

while(<condition>)
{ <statement>; }

do { <statement>; }
while(<condition>);
```

### **I/O 연산자**

```cpp
istream >> var; //입력 연산자
ostream << var; //출력 연산자

int n;
scanf("%d", &n);
printf("%d", n);
```

### **파일 I/O**

```cpp
fstream file;
file.open("filename", <file mode constant>);
// read using opeartor
file >> var;
file << var;
// getline
getline(file, line);
// reading and writing binary
file.read(memory_block, size);
file.write(memory_block, size);
file.close();
// File Mode Constants
ios::in     // 읽기 가능
ios:out    // 쓰기 가능
ios::ate    // EOF 찾아가기(seek)
ios::app   // EOF에 이어서 쓰기
ios::trunc // 이전 내용 버리기
ios::nocreate   // 만들어진 파일이 없으면 실패
ios::noreplace // 만들어진 파일이 있으면 실패
// C-Style
/* FEOF example */
FILE * pFile;
char buffer [100];
pFile = fopen ("myfile.txt" , "r");
if (pFile == NULL) perror ("Error opening file");
else {
while ( ! feof (pFile) ) {
if ( fgets (buffer , 100 , pFile) == NULL )break;
        fputs (buffer , stdout);
    }
    fclose (pFile);
}
```

### **함수(function)**

```cpp
<return_data_type> <function_name>(parameter list)
{ body }
```

### **사용자 정의 자료형**

```cpp
// 구조체(struct)
struct <structure_name>
{
public:
  member_type1 member_name1;
protected:
private:
  ...
};

// 클래스(class)
class <class_name>
{
public:
  // method_prototypes
protected:
  // method_prototypes
private:
  // method_prototypes
  // data_attributes

};
```

### **객체(objects)**

```cpp
myStruct m;
m.var1 = value;

myClass c;
var = c.method1(arg);

myStruct* pm = new myStruct;
pm->var1 = value;

myClass* pc;
var = pc->method1(arg);
```

# 연산자, 스코프, 저장 클래스

---

## 연산자

| 연산자 | 이름 | 사용 예시 | 설명 |
| --- | --- | --- | --- |
| `.` | 멤버 접근 연산자 | `obj.member` | 객체나 구조체의 멤버에 접근할 때 사용 |
| `->` | 포인터 멤버 접근 연산자 | `ptr->member` | 포인터가 가리키는 객체의 멤버에 접근 |
| `::` | 스코프 해석 연산자 | `std::cout`, `ClassName::member` | 네임스페이스, 클래스의 static 멤버, 전역 변수 등을 명시적으로 사용할 때 |
| `<<`, `>>` | 스트림 연산자 (오버로딩) | `std::cout << "Hello"` | 원래 비트 연산자이나 iostream에서는 입출력 연산자로 오버로딩됨 |

> <<, >>는 체이닝, 가독성, 객체 출력 지원 등의 이유로 iostream에서 오버로딩됨
> 

---

## 스코프

| 스코프 종류 | 설명 | 예시 |
| --- | --- | --- |
| **namespace** | 이름 충돌 방지용 논리적 묶음 | `namespace mylib { void func(); }` |
| **struct** | 기본 접근 제어: public | `struct MyStruct { int x; };` |
| **class** | 기본 접근 제어: private | `class MyClass { private: int x; };` |
| **function scope** | 함수 내부에서만 유효 | `void f() { int x; }` |
| **block scope** | 블록 `{}` 내에서만 유효 | `if (true) { int y; }` |
| **global scope** | 프로그램 전체에서 유효 | `int g = 0;`, `::g` |

---

## 저장 클래스 및 상수 키워드

| 키워드 | 범위 | 생존 기간 | 사용 예시 | 설명 |
| --- | --- | --- | --- | --- |
| `global` | 전역 | 프로그램 종료 시까지 | `int g = 0;` | 전역 변수. 모든 함수에서 접근 가능. 파일 간 공유 시 `extern` 필요 |
| `static` (지역 변수) | 함수/블록(로컬) | 프로그램 종료 시까지 | `static int count = 0;` | 함수 내에서 값을 유지. 초기화는 1회만 수행 |
| `static` (클래스 멤버) | 클래스 | 프로그램 종료 시까지 | `static int shared;` | 모든 인스턴스가 공유. `ClassName::shared`로 접근 |
| `const` | 선언된 범위 | 선언된 후 소멸까지 | `const int PI = 3.14;` | 상수. 값 재할당 불가. 포인터와 조합 시 const 위치 주의, 읽기 전용 |
| `constexpr` | 컴파일 타임 | 선언된 후 소멸까지 | `constexpr int x = 2 + 3;` | `const`보다 강력한 컴파일 상수. 템플릿 인수로 사용 가능 |
| `extern` | 전역 | 연결 시간 | `extern int g;` | 외부 파일에 정의된 변수 참조 시 사용 |

---

## 예제 코드

```cpp
cpp
복사편집
// 전역 변수
int global_count = 0;

// 정적 지역 변수
void countUp() {
    static int count = 0;
    count++;
    std::cout << "count: " << count << "\n";
}

// 상수
const double PI = 3.14159;

// static 클래스 멤버
class Logger {
public:
    static int log_level;
};
int Logger::log_level = 1;

```

---

## 요약

- `.` / `>` : 멤버 접근 방식 구분 (직접 / 포인터)
- `::` : 네임스페이스, 클래스 static, 전역 스코프 접근
- `<<`, `>>` : 스트림 오버로딩 연산자
- `static` : 지역(값 유지), 클래스(static 멤버)
- `const`, `constexpr` : 상수 표현
- `extern` : 외부 선언 참조

# 변수와 함수

## 변수의 선언(Declaration)과 초기화(Initialization)

```cpp
cpp
복사편집
int n = 0;     // 복사 초기화 (copy initialization)
int n(0);      // 직접 초기화 (direct initialization)
int n{0};      // 리스트 초기화 (uniform initialization, C++11~)
int n = {0};   // 복사 리스트 초기화
int x[2] = {1, 2}; // 배열 초기화
```

- int n{0};는 narrowing conversion(예: double → int)을 방지하는 안전한 초기화 방식입니다.

---

## 함수의 선언과 정의

```cpp
cpp
복사편집
// 함수 선언 + 정의 (단일 파일 내)
void func(int a, int b) {
    // ...
}
```

### 클래스 멤버 함수의 선언과 정의

> 보통 헤더(.h) 파일에 선언, 소스(.cpp) 파일에 정의합니다.
> 

```cpp
복사편집
class C : public <parent> {
private:               // 선언 없을 시 기본값(class)
    int value;

public:
    C(int v);          // 생성자 선언
    void doSomething(); // 멤버 함수 선언
    ~C();              // 소멸자 선언
};

// 멤버 함수 정의
C::C(int v) : value(v) {}

void C::doSomething() {
    // ...
}

C::~C() {
    // ...
}
```

---

## 함수의 중첩(Nested Function)은 **불가능**

```cpp
cpp
복사편집
void outer() {
    void inner() { // ❌ 오류 발생: 중첩 함수는 허용되지 않음
        // ...
    }
    inner(); // 불가
}
```

### 대안: 람다(lambda)를 사용한 지역 함수 정의

```cpp
복사편집
void outer() {
    auto inner = []() {
        // 내부 함수처럼 사용 가능
    };
    inner();
}
```

---

## 요약 정리

| 항목 | 지원 여부 | 설명 |
| --- | --- | --- |
| 변수 다형 초기화 | ✅ | `=`, `()`, `{}` 모두 사용 가능 |
| 배열 초기화 | ✅ | `int x[2] = {1, 2};` |
| 함수 선언/정의 분리 | ✅ | 클래스 및 일반 함수 모두 |
| 함수 중첩 정의 | ❌ | 표준 C++에서는 금지 |
| 람다 함수 | ✅ | 함수 내부에서 사용 가능한 함수 객체 |