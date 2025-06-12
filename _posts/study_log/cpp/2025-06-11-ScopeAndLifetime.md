---
title: (C++)7. Scope and Lifetime
post_order: 7
thumbnail: https://dvrtechnopark.wordpress.com/wp-content/uploads/2014/02/4970b-scopeandlifetime.jpg
layout: post
author: jhj
categories:
  - StudyLog
  - Cpp
tags:
  - Programming
  - Language
  - C++
excerpt: 함수, 클래스 등의 scope 범위와 변수 등의 lifetime 설정
project_rank: "600"
sticker: emoji//1f4aa
---
# Scope

## block
> scope을 생성하는 가장 간단한 형태

```cpp
int main()
{
    int a = 0;      // scope of the first 'a' begins
    ++a;            // the name 'a' is in scope and refers to the first 'a'
    {
        int a = 1;  // scope of the second 'a' begins
                    // scope of the first 'a' is interrupted
        a = 42;     // 'a' is in scope and refers to the second 'a'                 
    }               // block ends, scope of the second 'a' ends
                    // scope of the first 'a' resumes
}                   // block ends, scope of the first 'a' ends
int b = a;          // Error: name 'a' is not in scope
```

## Namespace
> [mdn web doc](https://developer.mozilla.org/ko/docs/Glossary/Namespace) 에서는 다음과 같이 정의하고 있다.
> 네임스페이스 (Namespace)는 프로그램에서 사용되는 이름의 논리적 그룹인 식별자의 컨텍스트입니다. 동일한 컨텍스트 및 범위 내에서, 식별자는 엔터티를 고유하게 식별해야 합니다.



### 정의 및 특징

- `namespace <name>{...}` 형태로 정의
- 일반적으로 헤더 파일에서 정의

```cpp
// header1.h
namespace header1 {
	int foo();
	void bar();
}
```

- 중첩 선언 가능
	- namespace1:: namespace2::someting
- <name\> 생략 시 해당 파일 안에서만 접근 가능
	-  <span style="color:rgb(255, 0, 0)">static 선언</span>과 같은 효과
	- 하나의 파일도 거대한 namespace 상 코드

```cpp
namespace N { // scope of N begins (as a member of global namespace)
    int i; // scope of i begins
    int g(int a) { return a; } // scope of g begins
    int j(); // scope of j begins
    void q(); // scope of q begins
    namespace {
        int x; // scope of x begins
    } // scope of x does not end
    inline namespace inl { // scope of inl begins
      int y; // scope of y begins
    } // scope of y does not end
} // scope of i,g,j,q,inl,x,y interrupted

namespace {
    int l=1; // scope of l begins
} // scope of l does not end (it's a member of unnamed namespace)

namespace N { // scope of i,g,j,q,inl,x,y continues
    int g(char a) {  // overloads N::g(int)
        return l+a;  // l from unnamed namespace is in scope
    }
    int i; // error: duplicate definition (i is already in scope)
    int j(); // OK: repeat function declaration is allowed
    int j() { // OK: definition of the earlier-declared N::j()
        return g(i); // calls N::g(int)
    }
    int q(); // error: q is already in scope with different return type
} // scope of i,g,j,q,inl,x,y interrupted

int main() {
    using namespace N; // scope of i,g,j,q,inl,x,y resumes
    i = 1; // N::i is in scope
    x = 1; // N::(anonymous)::x is in scope
    y = 1; // N::inl::y is in scope
    inl::y = 2; // N::inl is also in scope
} // scope of i,g,j,q,inl,x,y interrupted
```

### 참고 사항
- 네임스페이스 블록 안에서 허용되는 구문은 **선언(Declaration) 또는 정의(Definition)** 
	- main 함수가 아니라면 실행이 안되기 때문에 문맥상 오류로 인식
- 위와 마찬가지 이유로 **함수 내**에서는 **namespace 사용 불가**

### 내부 접근방법
-  `<namespace>::<obj>` : 범위 지정 연산자(scope resolution operator) 사용
- `using <namespace>::<obj>` : nampesapce 없이 `<obj>` 로 사용
- `using namespace <namespace>` : 해당 scope에서 namespace 생략

```cpp
namespace N
{
    int n;
    void fn(){
        printf("fn\n");
    }
} // namespace N

namespace N
{
    void fn(char* c){
        printf("N::n = %d\n", n);
    }
    // fn();	// error, 명시적 선언이 없음(즉 선언문으로 인식)
} // scoping namespace N


int main() {
    using N::fn;
    using namespace std;

    fn();
    fn("s");
    cout << "namespace std" << "\n";

} 

>>> 
fn
N::n = 0
namespace std
```

## Function & Parameter
> 함수는 일반적으로 지역 범위 생성.
> parameter의 경우 () 안에서는 scoping 불가

```cpp
void fn(int a, int b=a){};	// 식별자 "a"이(가) 정의되어 있지 않습니다.
```

## Class
> 하나의 class는 <span style="color:rgb(255, 0, 0)">자체적인 scope</span>을 가진다.
> 즉 class 자신을 나타내는 this 없이 멤버 변수에 접근이 가능하다.
> class 외부에서는 범위 지정 연산자(scope resolution operator) `::` 을 통해 scope을 생성한다.

```cpp
class X {
    int f(int a = n) { // X::n is in scope inside default parameter
         return a*n;   // X::n is in scope inside function body
    }
    using r = int;
    r g();
    int i = n*2;   // X::n is in scope inside initializer

//  int x[n];      // Error: n is not in scope in class body
    static const int n = 1;
    int x[n];      // OK: n is now in scope in class body
};

//r X::g() {       // Error: r is not in scope outside of out-of-class member function body
auto X::g()->r {   // OK: trailing return type X::r is in scope
    return n;      // X::n is in scope in out-of-class member function body
}
```

- `int f(int a = n)` : class 전체 scope에서 n 선언을 인식
	- 단 static 없이 n을 선언(int n;)하게 된다면 n은 멤버함수가 돼 오류가 발생
	- **인스턴스 없이**는 **존재하지 않는 값**이기 때문

## 기타

### goto & label
> goto를 통한 label의 이동은 선언의 순서와 관계 없다.

```cpp
void f()
{
    {   
        goto label; // label in scope even though declared later
label:;
    }
    goto label;     // label ignores block scope
}

void g()
{
    goto label;     // error: label not in scope in g()
}
```

### try, catch
> `try-catch` 블록은 각각 **block scope**를 형성한다.  
catch 절은 바로 앞의 try 블록과 연결되며, 내부 변수는 각 블록 내에서만 유효하다.

- `try` 블록 안에서 선언된 변수는 `try` 블록 내에서만 유효
- `catch` 절에서 선언된 변수도 해당 `catch` 블록 안에서만 유효
- 각각 별도의 block scope를 형성

```cpp
int main() {
    try {
        int a = 10;
        throw a;
    } catch (int e) {
        std::cout << "Caught exception: " << e << std::endl;
    }

    // std::cout << a << std::endl; // ❌ Error: a는 try 블록 밖에서 scope 벗어남
    // std::cout << e << std::endl; // ❌ Error: e도 catch 블록 안에서만 유효
}
```
# Lifetime

## static
> `static` 키워드는 **수명(lifetime)은 전체 프로그램**,  
**scope은 정의된 block(함수, 클래스, 파일)에 제한되는** 저장 클래스 지정자이다.

- 함수 내 static 변수는 해당 함수가 끝나도 메모리에 남아있으며 다음 호출 시 그대로 사용됨
	- 이 때 값의 <span style="color:rgb(255, 0, 0)">할당은 최초 1회</span>만 실행
- 파일 내부에서 `static` 전역 변수나 함수는 **해당 translation unit에서만 접근 가능 (internal linkage)**

```cpp
void foo() {
    static int count = 0;  // 함수가 여러 번 호출되어도 count는 한 번만 초기화됨
    ++count;
    std::cout << count << std::endl;
}

// a.cpp
static int hidden = 42; // 다른 파일에서 접근 불가
static void secret() {} // 외부에서 링크 안 됨
```

## extern
> 다른 translation unit (파일)에서 정의된 변수를 참조할 수 있도록 **외부 linkage**를 허용

- 선언만 하고 정의는 외부 파일에 있는 전역 변수/함수를 참조할 수 있게 함
- <span style="color:rgb(255, 0, 0)">정의는 한 번만</span>, `extern` 선언은 여러 곳에서 가능

```cpp
// a.cpp
int shared = 100;

// b.cpp
extern int shared;  // a.cpp의 shared를 참조
```

# 요약

|키워드/구문|Scope|Lifetime|특징 요약|
|---|---|---|---|
|`block`|`{}` 내부|block 종료 시|내부 변수는 밖에서 접근 불가|
|`namespace`|명시된 이름 범위|프로그램 전체|이름 중복 방지, 선언/정의만 가능|
|`function`|함수 내부|함수 종료 시|parameter도 local scope|
|`class`|class 블록 내부|객체 수명과 일치 (static은 예외)|멤버 변수, 멤버 함수 포함|
|`try-catch`|try/catch 각각의 block|block 종료 시|catch 변수는 내부에서만 사용 가능|
|`static`|선언 위치(block/fn/file)에 따라|프로그램 전체 (1회 초기화)|scope는 제한되나 lifetime은 전역|
|`extern`|참조된 파일의 전역 범위|참조된 객체와 동일|외부 파일 참조 용도|