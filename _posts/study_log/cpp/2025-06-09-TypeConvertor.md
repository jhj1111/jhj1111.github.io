---
title: (C++)5.형변환
post_order: 5
thumbnail: https://techvidvan.com/tutorials/wp-content/uploads/2021/06/Type-Conversion-in-C.jpg
layout: post
author: jhj
categories:
  - StudyLog
  - Cpp
tags:
  - Programming
  - Language
  - C++
excerpt: C++의 형변환의 종류와 기능
project_rank: "680"
sticker: emoji//1f4aa
---
# Type conversion
>  서로 다른 자료의 형태를 맞춰주는 것으로, 암묵적(implicit), 명시적(explicit) 형변환(conversion) 이 존재한다.


![/assets/images/study_log/cpp/2025-06-09-TypeConvertor/conversion_diagram.png](/assets/images/study_log/cpp/2025-06-09-TypeConvertor/conversion_diagram.png)
## Implicit (widening) conversion
>  widening conversion : 서로 다른 자료형 중 **더 큰 범위**(int -> float)로 변환이 일어나는 것


- 대부분의 언어는 **implicit conversion**으로 **widening conversion 방식**을 지원, C++도 마찬가지
- conversion을 인정하지 않는 경우(strong typing)도 있음
	- **명시적 생성(explicit construction)** : {}을 이용한 선언(`<type><var> {value}`)이 대표적
	- 단 {}을 이용한 선언은 배열 선언과 주의(특히 auto 선언)
	 ```cpp
	  int i = 1.0;	// ok, int
	  int i {1.0}; 	// error
	  int i = {1.0}; // error 
	  auto array = {1.0};	// array type
	```
	
```text
정렬 순서 : 
char<unsigned char<short<unsigned short<int
<unsigned int<long<unsigned long<float<double<long long<unsigned long <long<bool<wchar_t
```
- 다만 implicit conversion의 경우 type 변환 외의 동작은 정의하지 않기 때문에 <span style="color:rgb(255, 0, 0)">사용에 주의해야함</span>

```cpp
#include <iostream> 
#include <typeinfo> // typeid() 

int main() { 
	int i = 5; 
	float f = 5.0f; 
	float one1, one2; 
	one1 = i / 4; 
	one2 = f / 4; 
	
	std::cout << "\n 결과 : " << one1 << "\t/ one1 type : " << typeid(one1).name() << "\n"; //(int)자동형변환 
	std::cout << " 결과 : " << one2 << "\t/ one2 type : " << typeid(one2).name() << std::endl; 
	return 0; 
}

---

결과 : 1       / one1 type : f
결과 : 1.25    / one2 type : f
```
- one 1 : **int/in**t 실행 결과로 소숫점 이하 버린 후 형변환, 즉 <span style="color:rgb(255, 0, 0)">연산 후 형변환이 이루어짐</span>
- one 2 : **float/int** -> float/float로 <span style="color:rgb(255, 0, 0)">widening conversion 후 연산</span>
 
## C-type type conversion
> `(T) value`

```cpp
int i = (int)3.141592;  //c-style
```
- 문법이 간결하나 어떤 변환인지 알기 어려움
 
## C++-type conversion
> `static_cast`, `const_cast`, `dynamic_cast`, `reinterpret_cast`

```cpp
static_cast<new_type>(value); ///< 형변환 방법을 컴파일러가 아는 경우
const_cast<new_type>(value); ///< 일시적으로 const 지정 또는 해제
reinterpret_cast<new_type>(value); ///< 자료를 재해석하여 형변환하는 것으로 주로 포인터형에 사용 
dynamic_cast<new_type>(value); ///< 상속 관계 중 다형성을 사용할 수 있는 경우 up, down 형변환
```
- **static_cast** : 일반적인 type 형변환, primary data type에 사용
- **const_cast** : `volatile` 및 `__unaligned` 특성을 제거하기 위해 사용
- **dynamic_cast** : scope 및 virtual table 설정, 다형 형식의 변환에 사용
- reinterpret_cast : 비트의 간단한 재해석에 사용 ~~이건 잘 모르겠다~~

# 용어
> 형변환이 가능한지, 혹은 의도대로 변환이 되었는지 확인하기 위해서는 type 확인이 필요하다. 또한 c-base 언어는 인식과는 달리 에러 검출이 엄격한 언어가 아니다. 따라서 run-time 에러 및 오류에 관해 인지를 할 필요가 있다.


## Typeinfo
>  **type_info 클래스**는 컴파일러가 프로그램 내에서 생성된 형식 정보를 설명


- 헤더파일 <typeinfo\> 필요
```cpp
class type_info { 
	public: type_info(const type_info& rhs) = delete; // cannot be copied 
	virtual ~type_info(); size_t hash_code() const; 
	_CRTIMP_PURE bool operator==(const type_info& rhs) const; 
	type_info& operator=(const type_info& rhs) = delete; // cannot be copied
	_CRTIMP_PURE bool operator!=(const type_info& rhs) const; 
	_CRTIMP_PURE int before(const type_info& rhs) const; 
	size_t hash_code() const noexcept; 
	_CRTIMP_PURE const char* name() const; 
	_CRTIMP_PURE const char* raw_name() const; 
};
```
- 프라이빗 복사 생성자만 존재 : 직접 **인스턴스화 불가**
- operator 지원 : `==`, `!=`
- `typeid(var).name()` : **type의 형태** 반환(i, f, ...)
- `typeid(var).raw_name()` : name과 비슷하나 사람이 읽을 수 있는 형식은 아니며 **비교 시 사용**하며 **속도가 빠름**.
- `typeid(<var1>).bafore(typeid(<var2>))` 
	- 정렬순서, 상속 관계 반환
	- 단 is-a 관계가 아닌 일반 클래스나 구조체 등은 결과를 보장할 수 없음
	```cpp
	typeid(long).before(typeid(bool))	// 1
	typeid(bool).before(typeid(long))	// 0
	``` 

## Undefined Behavior
> C++표준 방식에서 금지한 방식. compile-time에서 error 없이 통과되나 <span style="color:rgb(255, 0, 0)">run-time에 어떤 방식으로 작동할 지 예측 불가</span>능한 상태. 
> 단순히 run-time에 에러나 오류를 발생(시키면 차라리 좋을텐데)하지 않으며, 상황에 따라 정상적으로 혹은 의도하지 않은 동작을 할 수 있다는 가능성이 있다는 점에서 매우 까다롭다.
 
- 예측 불가능한 결과
- 메모리 손상
- 이상한 값 출력
- 프로그램이 멀쩡히 돌아가는 것처럼 보이다가 나중에 망가짐
- 보안 취약점 발생
- 기타 등등
- 여튼 안좋음
 
# C++ type conversion

## static_conversion
> 일반적인 type 형변환, primary data type에 사용.
> 사용자 정의 자료형 형변환의 경우 `operator conversion_type() { ... }` 를 통해 형변환 방법을 정의해야 한다.

- `static_cast<type>(var)` (이때 <>는 실제 기호임) 
- 기본 자료형 형변환
```cpp
double dValue = 3.141592; 
int nValue = 0; 
nValue = static_cast<int>(dValue);
```
- 사용자 정의 형변환

```cpp
#include <bits/stdc++.h> 
struct Double; 

struct Int { 
	Int(){} 
	Int(int n) : value(n) {} 
	int value = 0; 
	operator Double(); 
}; 

std::ostream& operator<<(std::ostream& os, const Int& n) { 
	os << n.value; 
	return os; 
} 

struct Double { 
	Double(){} 
	Double(double d) : value(d) {} 
	double value = 0.; 
	operator Int(); 
}; 

Int::operator Double() { return static_cast<double>(value); } 
Double::operator Int() { return static_cast<int>(value); } 

std::ostream& operator<<(std::ostream& os, const Double& d) { os << d.value; return os; } 

using namespace std; 

int main() { 
	Int n(1234); 
	Double d(3.14); 
	cout << n << ',' << d << '\n'; 
	n = d; 
	d = static_cast<Double>(n); 
	cout << n << ',' << d << '\n'; 
}

---

1234,3.14 
3,3
```

## const_conversion
> 클래스에서 **`const`**, `volatile` 및 `__unaligned` 특성을 제거

- const로 **취급**되는 함수나 **원본이 const가 아닌** reference를 변경할 시 사용
- 단 const_conversion 캐스팅 <span style="color:rgb(255, 0, 0)">이후 동작은 추적하지 않으므로</span> 주의가 필요

```cpp
#include <iostream>

struct type {
    int i;

    type(): i(3) {}

    void f(int v) const {
        // this->i = v;                 // compile error: this is a pointer to const
        const_cast<type*>(this)->i = v; // OK as long as the type object isn't const
    }
};

int main() 
{
    int i = 3;                 // i is not declared const
    const int& rci = i; 
    const_cast<int&>(rci) = 4; // OK: modifies i
    std::cout << "i = " << i << '\n';

    type t; // if this was const type t, then t.f(4) would be undefined behavior
    t.f(4);
    std::cout << "type::i = " << t.i << '\n';

    const int j = 3; // j is declared const
    [[maybe_unused]]
    int* pj = const_cast<int*>(&j);
    // *pj = 4;      // undefined behavior

    [[maybe_unused]]
    void (type::* pmf)(int) const = &type::f; // pointer to member function
    // const_cast<void(type::*)(int)>(pmf);   // compile error: const_cast does
                                              // not work on function pointers
}
```
- const 함수는 2가지 특징을 가짐
	- 내부에서 변수 변경 불가
	- const로 지정된 함수만 호출 가능
	- `this->i = v` : const 함수인 f의 포인터 this -> 변경불가
	- `const_cast<type*>(this)->i = v` : 일시적으로 변경 가능 상태. 단 **type**은 **const이면 안됨**
- `const_cast<int&>(rci) = 4` 
	- `const int& rci = i` rci는 const이나 rci의 원본 **i는 const가 아니므로** 변환 가능
- `int* pj = const_cast<int*>(&j)` 
	- j는 변경 불가이므로 포인트 할당 `int* pj = j` 불가
	- const_cast로 const 일시 해제
	- 이후  `*pj = 4` 실행 시 <span style="color:rgb(255, 0, 0)">오류가 발생하지 않으나 const인 j 변수를 바꾸는 행위(UB)</span>이므로 매우 위험

## dynamic_conversion
- **RTTI(RunTime Type Information)** : 프로그램 실행 중에 개체의 형식이 결정될 수 있도록 하는 메커니즘
- 객체의 다형성은 run-time에 의해 결정되므로 RTTI 사용
- 하지만 구글 C++ 스타일 가이드 및 많은 C++ 프로젝트에서 <span style="color:rgb(255, 0, 0)">사용을 금하고 있음</span>
- 따라서 대략적인 개념만 이해하고 자세하게 설명하진 않을 예정

### up/downcast
![/assets/images/study_log/cpp/2025-06-09-TypeConvertor/up_downcast.png.png](/assets/images/study_log/cpp/2025-06-09-TypeConvertor/up_downcast.png.png)
출처: [https://nybot-house.tistory.com/66](https://nybot-house.tistory.com/66)
- **Upcast**: Derived(Child) 클래스에서 Base(Parent) 클래스로 변환하는 것 , 즉 <span style="color:rgb(255, 0, 0)">상위클래스로 변환</span>
- **Downcast**: Base(Parent) 클래스에서 Derived(Child) 클래스로 내려 변환하는 것, 즉 <span style="color:rgb(255, 0, 0)">하위클래스로 변환</span>

### Downcast
> 클래스의 implicit방식의 upcast는 허용되나 <span style="color:rgb(255, 0, 0)">downcast는 허용하지 않음</span>(compile error). 즉 dynamic_conversion은 **downcast를 위한 형변환**.

- dynamic_cast 불가 시 **nullptr** 반환

```cpp
Parent* pPtr = new Child() 
Child* cPtr = dynamic_cast<Child*>(pPtr);	// Child Ptr 혹은 nullptr(변환 불가 시) 반환

if(cPtr == nullptr);
```

- 상위 클래스에서 하위 클래스를 참고(scope)할 수 없음
- 위 기능을 사용하기 위해 dynamic_cast 사용
	- <span style="color:rgb(255, 0, 0)">static_cast</span>를 통해서도 가능하나 <span style="color:rgb(255, 0, 0)">매우 위험한 방식</span>
- 다음과 같은 예시가 있을 때
	- parent (상위 클래스), child (하위 클래스), virtual (오버로드된 멤버 함수), sub_func (하위 클래스에서만 정의된 함수)

```cpp
pPtr->virual();		// Child::virtual()
pPtr->sub_func();	// error, scope 불가
cPtr->sub_func();	// Child::virual()
```