---
title: (C++)3. 자료형과 변수
post_order: 3
thumbnail: https://acaroom.net/sites/default/files/uploads/datatypec.png
layout: post
author: jhj
categories:
  - StudyLog
  - Cpp
tags:
  - Programming
  - Language
  - C++
excerpt: c++ 자료형의 종류와 변수의 선언
project_rank: "680"
sticker: emoji//1f4aa
---

# 서론

## 자료형

> 자료를 저장하기 위한 형식
 

| 종류 | 정의 | 예시 |
| --- | --- | --- |
| primary data types | 스스로 정의되는 타입 | `char`, `int`, `double`, … |
| user defined data types | 사용자가 정의한 타입 | `class`, `struct`, `enum`  |

## 변수

> 정의한 자료형의 값을 저장할 수 있는 메모리 공간
 
- 변수 $\subset$ 객체
    - 단 모든 class가 변수인건 아님(멤버 함수만 있는 경우)
- 기능(특히 scope 범위)에 따른 분류
    - `static`, `const`, `dynamic`, `auto`, …
- 일반적으로(C++)
    - 기본 자료형으로 정의 : 변수
    - 사용자 정의 자료형 : 객체
- Case sensitivity 적용(대소문자 구별)

## 예시

```cpp
//! 정의 : 자료형 변수명;
bool b;     ///< boolean 자료형
char c;     ///< character 자료형
int n;      ///< integer 자료형
double d;   ///< double-precision floating point 자료형
//! 선언 : extern 자료형 변수명;
extern int n;
//! 정적 변수 : static
extern static int n;
static int n
//! 상수 : const
const int n;
//! 상수 표현식 : constexpr
constexpr int n;
```

# 자료형(Types)

## 용어

- 리터럴(literal) : 사전적 의미로는 문자 그대로 순서대로 표현 되어 있는 것
    - 숫자, 문자 리터럴
- 리터럴 자료형(literal type) : `constexpr`변수로 `constexpr` 함수에서 return되는 값의 자료형
- **lvalue**, **rvalue**, xvalue, gvalue, prvalue
    - **lvalue** : 표현식에서 왼쪽(left)에 온다는 의미로, 함수 또는 객체
    - **rvalue** : lvlue와 마찬가지로 오른쪽(right)에 온다는 의미로, lvalue가 아닌 것(주로 할당에 사용되는 값)
    - xvalue(”eXpring” value) : 수명이 거의 끝나가는 객체. 주로 retrun 값
    - gvalue(”generalized” value) : lvalue 혹은 xvalue
    - prvalue(”pure” rvalue) : xvalue가 아닌 rvalue(예 : 반환 유형이 참조가 아닌 함수를 호출 한 결과는 prvalue이다).
- 연결속성 : **각각 링크가 연결된 대상의 범위**. 내부/외부 속성이 존재하며, 파일 외부에서 변수 등을 참조 가능한지 여부

## const(constanct), constexpr

> 가변의 객체를 불변으로 정의하는 예약어
> 
> - `const int nNum` == `int const nNum`
> - 오른쪽이 기본형이나 주로 **왼쪽**의 형태로 사용
  
- <span style="color:rgb(255, 0, 0)">읽기 전용</span>이라 생각하면 됨
- 할당 후 변경은 불가(단 casting을 이용할 경우 제외)하나 return값을 이용해 할당가능(**run-time**)
- const : **run-time** binding
- **constexpr**의 경우 **compile-time binding**
    - 즉 할당은 rvalue의<span style="color:rgb(255, 0, 0)"> literal 상수</span> 혹은 <span style="color:rgb(255, 0, 0)">상수표현식(변수 혹은 return)</span>으로만 이루어짐

```cpp
const int num = 5;         // 상수 정수형 num에 5를 저장
constexpr int var = 10;    // 상수표현식 정수형 var에 10을 저장

double fnStDev(const vector<double>&);
double fnMean(const vector<double>&);

vector<double> vecDbl { 1.3, 2.4, 1., 2.7, 3.2, 1.8, 2.9 };
const double stdev = fnStDev(vecDbl);   // 런타임에 fnStDev 리턴 값으로 상수 정의
constexpr double mean = fnMean(vecDbl); // error, fnMean이 constexpr이 아니다.

---

constexpr double square(double x) { return x*x; };

int main()
{
    int var = 0;                // 일반 변수 num에 0을 저장
    const int c_num = 5;        // 상수 정수형 num에 5를 저장
    constexpr int c_var = 10;    // 상수표현식 정수형 var에 10을 저장

    constexpr double area1 = 3.14*square(var);       
    /* error : 
    global_var.cpp(13, 30): 
    the value of variable "var" 
    (declared at line 9) cannot be used as a constant */
    constexpr double area1 = 3.14*square(5);       // 3.14*square(5)는 상수표현식이다.
    constexpr double area2 = 3.14*square(c_var);      // c_var은 상수표현식.
    constexpr double area3 = 3.14*square(c_num);      // c_num은 상수.
    const double area4 = 3.14*square(c_var);          // 런타임에 계산된 값을 상수로 정의한다.
    
    return EXIT_SUCCESS;
}
```

- **포인터**의 경우 주의가 필요

```cpp
int const * p1 = new int;  // 또는 const int * p1 = new int;
*p1 = 10; // error
delete p1;
p1 = new int; // ok

---

int * const p2 = new int;
*p2 = 10; // ok
delete p2;
p2 = new int; // error
```

## static, extern

> static : **local 변수** + lifetime 변경(<span style="color:rgb(255, 0, 0)">프로그램 종료시</span>), 정적 변수(static variable)
extern : compiler에게 **변수의 선언**을 명시

- 연결속성
    - static : **내부연결**
    - extern : **외부연결** 가능
- static은 지역변수의 scope을 가진 global 변수로 생각
    - 즉 함수를 벗어난 후(local의 경우 소멸) 다시 진입할 시 <span style="color:rgb(255, 0, 0)">기존 값 유지</span>
- static 변수의 경우 접미사로 **s_**를 사용(일반적으로)
- 멤버 함수/변수 등 함수와 class를 static으로 선언 가능하며, 해당 파트에서 다룰 예정

## typedef, using

> 별칭(alias) 선언

```cpp
typedef unsigned int uint;
using uchar = unsigned char;  // C++11~

uint n;
uchar uch;
```

- using의 경우 C++11부터 사용가능하며, namespace의 오버로드된 형태

## endian(엔디언)

엔디언은 정수 자료형을 1차원 공간에 바이트 정렬(byte order)하는 방법을 말하며 대표적으로 빅엔디언(big-endian), 리틀엔디언(little-endian)이 있으며 CPU Architecture에 따라 다르다.

예로 `int` 자료형은 4byte이므로 값을 0x01020304(16진수 표현)로 하면 아래 표와 같이 정렬 된다. 따라서, 자료 전달시 host-to-network, network-to-host 를 지원하는 함수(`htonl`, `htons`, `ntohl`, `ntohs` 등)들을 이용하여 자료의 엔디언을 변환 해야한다. 네트워크 프로그래밍이나 바이너리 파일 같이 이종 시스템과 통신이나 자료 교환이 필요한 경우 엔디언에 맞게 자료를 처리해야 한다.

빅엔디언의 경우

| byte order | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| bit order | 31-24 | 23-16 | 15-8 | 7-0 |
| value | 0x01 | 0x02 | 0x03 | 0x04 |

리틀엔디언의 경우

| byte order | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| bit order | 31-24 | 23-16 | 15-8 | 7-0 |
| value | 0x04 | 0x03 | 0x02 | 0x01 |

출처: [C++이야기(A story of C++)](https://wikidocs.net/50830)

## auto, decltype, typeinfo

> binding을 compile 타임에 결정
- auto : 할당되는 값을 참고하여 binding
- decltype : 선언된 변수를 참고하여 binding

```cpp
auto n = 10;
decltype(n) d = 3;
```

### {}를 이용한 할당

- auto 사용 시 배열 선언과 충돌할 수 있음(아래 예시의 n4, d4)
- strong typing
    - 따라서 형변환을 의도한게 아니라면 `type <var> {<value>}`을 사용하는게 좋을 수 있음

```cpp
int n = {3.14}; // error
int n {3.14};  // error
```

```cpp
#include <iostream>
#include <cstdlib>
#include <typeinfo>

using namespace std;

int main()
{
    auto n1(0);
    auto n2 = 0;
    auto n3 {0};
    auto n4 = {0};

    auto d1(0.);
    auto d2 = 0.;
    auto d3 {0.};
    auto d4 = {0.};

    std::cout << typeid(n1).name() << std::endl;
    std::cout << typeid(n2).name() << std::endl;
    std::cout << typeid(n3).name() << std::endl;
    std::cout << typeid(n4).name() << std::endl;
    std::cout << typeid(d1).name() << std::endl;
    std::cout << typeid(d2).name() << std::endl;
    std::cout << typeid(d3).name() << std::endl;
    std::cout << typeid(d4).name() << std::endl;

    return EXIT_SUCCESS;
}

result---

n1 = i
n2 = i
n3 = i
n4 = St16initializer_listIiE
d1 = d
d2 = d
d3 = d
d4 = St16initializer_listIdE
```